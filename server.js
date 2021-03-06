// =======================
// get the packages we need ============
// =======================
var express     = require('express');
var app         = express();
var bodyParser  = require('body-parser');
var morgan      = require('morgan');
var ping 		= require('ping');
var cors 		= require('cors');

var passwordHash = require('password-hash');
var jwt    		= require('jsonwebtoken'); // used to create, sign, and verify tokens
var config 		= require('./config'); // get our config file
var sqlite3 	= require('sqlite3').verbose();
var db 			= new sqlite3.Database('local_api.db');

// =======================
// configuration =========
// =======================
var port = process.env.PORT || 8080; // used to create, sign, and verify tokens
app.set('superSecret', config.secret); // secret variable

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// use morgan to log requests to the console
app.use(morgan('dev'));

// Cors
var originsWhitelist = [
  'http://localhost',      //this is my front-end url for development
  'http://www.myproductionurl.com'
];

var corsOptions = {
  origin: function(origin, callback){
        var isWhitelisted = originsWhitelist.indexOf(origin) !== -1;
        callback(null, isWhitelisted);
  },
  credentials:true
}
app.use(cors(corsOptions));

//////////////////////////////////
////          FRONT           ////
//////////////////////////////////

const allowed = [
  '.js',
  '.css',
  '.png',
  '.jpg',
  '.html',
  '.json'
];

// Permet de forcer le routage angular plutôt que le routage node (/*)
// N'autorise que les fichiers avec les extensions listées.
app.get('/site/*', function(req, res) {
 if (allowed.filter(ext => req.url.indexOf(ext) > 0).length > 0) {
      return res.sendFile(req.url.replace('/site',''), { root: __dirname });
   } else {   
      return res.sendFile("index.html", { root: __dirname+"/front/" });
   }
	
});

//////////////////////////////////
////          SETUP           ////
//////////////////////////////////

// A commenter une fois la table créé (à mettre dans script.sh plutôt)
// app.get('/setup', function(req, res) {

//  	db.serialize(function () {

//  		var table_name = "Users";
//  		var query_table = "CREATE TABLE IF NOT EXISTS " + table_name + "([Id] INTEGER PRIMARY KEY, [Username] [varchar](64) UNIQUE NOT NULL, [Password] [varchar](128) NOT NULL, [Mail] [varchar](128) UNIQUE NOT NULL);";
//  		db.run(query_table);
//  		return res.json({ 
// 			success: true,
// 		});    
//    	});	
//    	return res.status(500).send({ 
// 		success: false
// 	});    
//  });

//////////////////////////////////
////        API ROUTES        ////
//////////////////////////////////


// get an instance of the router for api routes
var apiRoutes = express.Router(); 

// route to show a random message (GET http://localhost:8080/api/)
apiRoutes.get('/', function(req, res) {
	return res.json({ message: 'Welcome to the coolest API on earth!' });
});


// route to authenticate a user (POST http://localhost:8080/api/authenticate)
apiRoutes.post('/authenticate', function(req, res) {
	
	var username = req.body.username;
	var password = req.body.password;

	console.log("Authenticate user : " + username);
	// find the user

	var query_exists = "SELECT * FROM Users WHERE Username='"+username+"';";

	db.all(query_exists, function (err, rows) {
		
	    if(err){
	        console.log(err);
	        return res.status(404).json({success: false, message : err.message});
	    }
	    console.log("results : " + rows.length);    

	    // TODO : extract to method vetifyPassword
        if (rows.length != 1 || !passwordHash.verify(password, rows[0].Password)){
        	return res.json({ success: false, message : "Invalid login/password" });
        }

		var token = jwt.sign({username : username}, app.get('superSecret'), {
			expiresIn: "15s" // expires in 24 hours
		});

		// return the information including token as JSON
		res.json({
			success: true,
			message: 'Enjoy your token!',
			token: token
		}); 
  	});
});

apiRoutes.post('/users/create', function(req, res) {
	adduser(res,req.body.username, req.body.password, req.body.mail);
});


//////////////////////////////////
////     SECURED METHODS      ////
//////////////////////////////////

apiRoutes.use(function(req, res, next) {

	// check header or url parameters or post parameters for token
	//var token = req.body.token || req.query.token || req.headers['Authorization'];

	var token = req.headers.authorization ? req.headers.authorization.replace("Bearer ", "") : null;
	
	// decode token
	if (token) {

		// verifies secret and checks exp
		jwt.verify(token, app.get('superSecret'), function(err, token) {      
			if (err) {
				return res.status(401).send({ 
					success: false,
					message: 'Failed to authenticate user'
				});    
			} else {
				// if everything is good, save to request for use in other routes
				req.token = token;    
				next();
			}
		});

	} else {

	    // if there is no token
	    // return an error
	    return res.status(403).send({ 
	    	success: false, 
	    	message: 'No token provided.' 
	    });

	}
});

apiRoutes.get('/ping', function(req, res) {
       return res.json(true);
});

////////////////////////
//////// USERS  ////////
////////////////////////

// route to return all users (GET http://localhost:8080/api/users)
apiRoutes.get('/users', function(req, res) {

	var query_exists = "SELECT Id,Username FROM Users;";
	db.all(query_exists, function (err, rows) {
	    if(err){
	        console.log(err);
	        return res.json({result: false, message : err.message});
	    }

        return res.json({users : rows});
    });
});

apiRoutes.put('/users/edit/', function(req, res){
	var username = req.token.username;
	var oldPassword = "";
	var newPassword = "";

	// Check if password matches

	// INSERT INTO

	return res.json({test : "test"});
});

////////////////////////
//////// STATUS  ///////
////////////////////////


apiRoutes.get('/status/:ip',function(req,res){
	var ip = req.params.ip;
	if (ip){
		var hosts = [ip];
		hosts.forEach(function(host){
		    ping.sys.probe(host, function(isAlive){
		        return res.json({ success: true, status: isAlive });    
		    });
		});
	}else {
		return res.json({ success: false, message: "No ip provided" });    
	}

});
// apply the routes to our application with the prefix /api
app.use('/api', apiRoutes)


// =======================
// start the server ======
// =======================
app.listen(port);
console.log('Magic happens at http://localhost:' + port);

///////////////////////////
///////// METHODS /////////
///////////////////////////

function adduser(res, username, password, mail){

	if (password == undefined || password == null){
		return res.json({result: false, message : "Missing password"});
	}
	
	if (username == undefined || username == null){
		return res.json({result: false, message : "Missing username"});
	}

	if (mail == undefined || mail == null){
		return res.json({result: false, message : "Missing mail"});
	}
	
	var password = passwordHash.generate(password);

	var query_exists = "SELECT * FROM Users WHERE Username='"+username+"' OR Mail='"+mail+"';";

	db.all(query_exists, function (err, rows) {
	    
	    if(err){
	        console.log(err);
	        return res.json({result: false, message : err.message});
	    }

        var check = checkUser(res, rows, username, mail);
        console.log(check);
        if (check.result == false){
        	return res.json(check);
        }
        

        console.log("creating query");
		var query_user = "INSERT INTO Users(Username, Password, Mail) VALUES (?,?,?)";
		console.log("query created");
		db.run(query_user, [username,password, mail], function(err){
		
			if (err) {
				return res.json({ result: false, message : err.message });
			}else{
				return res.json({ result: true });		
			}
		});	    
  	});
}

// Checks if the user already exists in DB
// returns result : false if exists, true otherwise

function checkUser(res, rows, username, mail){

	if (rows.length != 0){
		
		var result;
		rows.forEach(function(item){
			if (item.Username == username){
				result = { result: false, message : "Username already used" };
				
			}
			else if (item.Mail == mail){
				result =  { result: false, message : "Email already used" };			
			}
		});

		return result;
	}
	return {result : true};
}



process.on('SIGINT', () => {
    db.close();
});
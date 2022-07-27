var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var jwt = require('jsonwebtoken');


var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var registracijaRouter = require('./routes/registracija')

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

let pomocne = {
  proveraLogina: function (req, res, next) {
    if(req.cookies.token_prijava){
      jwt.verify(req.cookies.token_prijava, 'kljuc', (err, decodedToken) =>{
        if(err){
          console.log(err.message);
          return 'false';
          //res.redirect('/registracija/login');
        } else {
          console.log('ima');
          console.log(decodedToken);
          return 'true';

          //next();
        }
      })
    } else {
      return 'false'; //stavio sam da vraca string pa kasnije poredim sa true i false
                      // jer iz nekog razloga dobijam uvijek kao rezultat undefined
      //res.redirect('/registracija/login')
    }
  },

}

app.locals.korpa = [];


app.use(function (req, res, next) {
  //res.clearCookie("token_prijava");

  /*
  if(!jwt.verify(req.cookies.token_prijava, 'kljuc')){
    if(req.url === '/registracija/login' || req.url === '/registracija' || req.url === '/registracija/trgovac' ||
        req.url === '/registracija/kupac'){
      return next();
    }
    res.redirect('/registracija/login');
  } else {
    if(req.url === '/registracija/login' || req.url === '/registracija/' || req.url === '/registracija/trgovac' ||
        req.url === '/registracija/kupac'){
      res.redirect('/');
    }
    next(); // provjera uloge korisnika zbog ruta
  }
*/

  if(pomocne.proveraLogina(req, res, next) === 'false'){
    //console.info('1 ' + !pomocne.proveraLogina(req, res, next));
    //console.info('2 ' + pomocne.proveraLogina(req, res, next));

    //console.info('netacan token');
    if((req.url === '/registracija/login' || req.url === '/registracija' ||
        req.url === '/registracija/trgovac' || req.url === '/registracija/kupac' ||
        req.url === '/registracija/registracijaTrgovca' || req.url === '/registracija/registracijaKupca')){
      return next();
    } else {
      res.redirect('/registracija/login');
    }
  } else {
    //console.info('tacan token');
    if((req.url === '/registracija/login' || req.url === '/registracija' ||
        req.url === '/registracija/trgovac' || req.url === '/registracija/kupac')){
      //console.info('usao')
      res.redirect('/');
    } else {
      next();
    }
  }
/*
  if (req.url === '/registracija/login' || req.url === '/registracija' || req.url === '/registracija/trgovac' ||
      req.url === '/registracija/kupac'){
    return next();
  }

  try {
    //console.info(req.cookies.token_prijava);
    var decoded = jwt.verify(req.cookies.token_prijava, 'kljuc');

    if(req.url === '/registracija/login' || req.url === '/registracija/' || req.url === '/registracija/trgovac' ||
        req.url === '/registracija/kupac'){
      res.redirect('/');
    }
    next();


  } catch (err){
    if(req.url === '/registracija/login' || req.url === '/registracija' || req.url === '/registracija/trgovac' ||
        req.url === '/registracija/kupac'){
      return next();
    }
    res.redirect('/registracija/login');
  }

 */
});



app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/registracija', registracijaRouter);

//app.use(express.static('public'));


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;

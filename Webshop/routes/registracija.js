var express = require('express');
var router = express.Router();
var bcrypt = require('bcrypt');
var jwt = require('jsonwebtoken');

const format = require('pg-format');
const { Pool, Client } = require('pg')

const pool = new Pool({
    user: 'xdgjkvtm',
    host: 'surus.db.elephantsql.com',
    database: 'xdgjkvtm',
    password: 'KHWv5fOUR6E3UhSRVWrpG77dgtIX6MRd',
    port: 5432,
    max: 10,
    idleTimeoutMillis: 30000,
})

let pomocne = {
    kriptuj: function (lozinka) {
        var hash = bcrypt.hashSync(lozinka, 10);
        return hash;
    },
}

let db = {
    registrujTrgovca: function (req, res, next) {
        var korisnik = {
            korisnickoIme: req.body.korisnicko_ime,
            ime: req.body.ime,
            prezime: req.body.prezime,
            kontaktTelefon: req.body.kontakt_telefon,
            adresaSjedista: req.body.adresa_sjedista,
            email: req.body.email,
            lozinka: pomocne.kriptuj(req.body.lozinka),
        }

        console.info(korisnik);
        pool.query(`insert into korisnik (korisnicko_ime, ime, prezime, email, lozinka, tip, telefon, adresa_sjedista) 
        values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
            [korisnik.korisnickoIme, korisnik.ime, korisnik.prezime, korisnik.email, korisnik.lozinka, 2, korisnik.kontaktTelefon, korisnik.adresaSjedista],
            (err, result) => {
            //pool.end();
            if (err){
                console.info(err);
                res.sendStatus(err);
            } else {
                //console.info(result)
                let kategorije = JSON.parse("[" + req.body.kategorije + "]");

                if(kategorije.length >= 0) {
                    let katerije_trgovine = [];
                    for (let i = 0; i < kategorije.length; ++i) {
                        let element = [];
                        element.push(kategorije[i]);
                        element.push(result.rows[0].id); //
                        katerije_trgovine.push(element);
                        console.log(katerije_trgovine);
                    }


                    let query1 = format('insert into kategorija_korisnik (kategorija_usluge, korisnik) VALUES %L returning id', katerije_trgovine);
                    pool.query(query1,
                        (err, result) => {
                            //pool.end();
                            if (err) {
                                console.info(err);
                                //res.end('{"error" : "Error", "status" : 500}');
                                res.sendStatus(err);
                            } else {
                                console.info(result.rows);
                                next();
                            }
                        });
                }
                next();
            }
        });
    },

    registrujKupca: function (req, res, next) {
        var korisnik = {
            korisnickoIme: req.body.korisnicko_ime,
            ime: req.body.ime,
            prezime: req.body.prezime,
            kontaktTelefon: req.body.kontakt_telefon,
            email: req.body.email,
            lozinka: pomocne.kriptuj(req.body.lozinka),
        }

        console.info(korisnik);

        pool.query(`insert into korisnik (korisnicko_ime, ime, prezime, email, lozinka, tip, telefon) 
        values ($1, $2, $3, $4, $5, $6, $7) returning id`,
            [korisnik.korisnickoIme, korisnik.ime, korisnik.prezime, korisnik.email, korisnik.lozinka, 3, korisnik.kontaktTelefon],
            (err, result) => {
                if (err){
                    console.info(err);
                    res.sendStatus(err);
                } else {
                    let interesi = JSON.parse("[" + req.body.interesi + "]");

                    if(interesi.length >= 0){
                        let interesi_kupca = [];
                        for(let i=0; i < interesi.length; ++i){
                            let element = [];
                            element.push(interesi[i]);
                            element.push(result.rows[0].id); //
                            interesi_kupca.push(element);
                            console.log(interesi_kupca);
                        }
                        let query1 = format('INSERT INTO interes (interes, kupac) VALUES %L returning id', interesi_kupca);
                        pool.query(query1,
                            (err, result) => {
                                //pool.end();
                                if (err){
                                    console.info(err);
                                    //res.end('{"error" : "Error", "status" : 500}');
                                    res.sendStatus(err);
                                } else {
                                    //console.info(result.rows);
                                    next();
                                }
                            });
                    }


                    //console.info(result);
                    next();
                }
            });
    },
    provjeriKorisnika: function (req, res, next) {
        var korisnik = {
            korisnickoIme: req.body.korisnicko_ime,
            lozinka: req.body.lozinka,

        };

        console.info(korisnik);
        pool.query(`select * from korisnik where korisnicko_ime = $1`,
            [korisnik.korisnickoIme],
            (err, result) => {
                //pool.end();
                if (err){
                    console.info(err);
                    //res.end('{"error" : "Error", "status" : 500}');
                    res.sendStatus(err);
                } else {
                    if (result.rows.length === 0){
                        return res.sendStatus(404);
                    } else {
                        if(Date.now() < result.rows[0].blokada){
                            res.redirect('/registracija/login');
                        }
                        let kriptoLozinka = result.rows[0].lozinka;

                        if (bcrypt.compareSync(korisnik.lozinka, kriptoLozinka)){
                            res.korisnik = {
                                id: result.rows[0].id,
                                korisnickoIme: result.rows[0].korisnicko_ime,
                                ime: result.rows[0].ime,
                                prezime: result.rows[0].prezime,
                                tip: result.rows[0].tip,
                                aktivnost: result.rows[0].aktivnost,
                            };
                            next();
                        } else {
                            console.info("Losa sifra!");
                            return res.sendStatus(401);
                        }
                    }
                }
            });
    },
    dobaviKategorijeTrgovine: function (req, res, next) {
        pool.query(`select * from kategorija_usluge`,
            (err, result) => {
                //pool.end();
                if (err){
                    console.info(err);
                    //res.end('{"error" : "Error", "status" : 500}');
                    res.sendStatus(err);
                } else {
                    console.info(result.rows);
                    req.kategorije = result.rows;
                    next();
                }
            });
    },
    dobaviKategorijeUsluga: function (req, res, next) {
        pool.query(`select * from kategorija_usluge;`,
            (err, result) => {
                //pool.end();
                if (err){
                    console.info(err);
                    //res.end('{"error" : "Error", "status" : 500}');
                    res.sendStatus(err);
                } else {

                    //console.info(result.rows);
                    req.kategorijeUsluga = result.rows;
                    next();
                }
            });
    },
}

/* GET users listing. */
router.get('/', function(req, res, next) {
    res.render('registracija', { title: 'Registracija' });
});

router.get('/trgovac',
    db.dobaviKategorijeTrgovine,
    function(req, res, next) {
    res.render('registracijaTrgovac', { title: 'Registracija', kategorije: req.kategorije });
});

router.get('/kupac',
    db.dobaviKategorijeUsluga,
    function(req, res, next) {
    res.render('registracijaKupac', { title: 'Registracija', interesi: req.kategorijeUsluga });
});

router.post('/registracijaTrgovca',
    db.registrujTrgovca,
    function(req, res, next) {
        //res.sendStatus(200);
        res.redirect('/registracija/login');
});

router.post('/registracijaKupca',
    db.registrujKupca,
    function(req, res, next) {
        //res.sendStatus(200);
        res.redirect('/registracija/login');
});

router.get('/login', function(req, res, next) {
    res.render('login', { title: 'Login' });
});

router.post('/login',
    db.provjeriKorisnika,
    function(req, res, next) {
        console.info(res.korisnik);

        let token = jwt.sign(res.korisnik, 'kljuc');

        res.cookie('token_prijava', token);
        //res.sendStatus(200);

        if (res.korisnik.tip === 1){
            res.redirect('/administrator');
        } else if(res.korisnik.tip === 2){
            res.redirect('/trgovacProfil');
        } else if (res.korisnik.tip === 3){
            res.redirect('/pocetna');
        }

});


module.exports = router;

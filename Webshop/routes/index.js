var express = require('express');
var router = express.Router();
var bcrypt = require('bcrypt');
var jwt = require('jsonwebtoken');
const nodemailer = require("nodemailer");




let testAccount = nodemailer.createTestAccount();

let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // use SSL
    //port: 587,
    //secure: false, // true for 465, false for other ports
    auth: {
        user: 'the.six.zupcici@gmail.com', // generated ethereal user
        pass: 'tepsijas123', // generated ethereal password
    },
});

const mailData = {
    from: 'the.six.zupcici@gmail.com',  // sender address
    to: 'semir_salaka@hotmail.com',   // list of receivers
    subject: 'Sending Email using Node.js',
    text: 'Selam alejk',
    html: '<b>Vasa narudzba na web shopu je uspjesno poslana </b><br> Bit cete obavjesteni o promjeni statusa narudzbe.<br/>',
};
/*
transporter.sendMail(mailData, function (err, info) {
                                        if(err)
                                            console.log(err)
                                        else
                                            console.log(info);
                                    });
 */


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
    sortirajArtikleIzKorpe: function (req, res, next) {
        console.info('nesortirano', req.app.locals.korpa);
        req.app.locals.korpa.sort((a, b) => (a.idTrgovca > b.idTrgovca) ? 1 : -1);
        console.info('sortirano', req.app.locals.korpa);
        next();
    },

    /**
     *
     * @param korpa - array itema
     * @param kupac_id - id trenutnog kupca
     * @param trgovci - array koji se popunjava svaki put kada se spremi nova narudzba (table narudzba)
     * @param trenutna_narudzba_id - cuva id od trenutne/zadnje ubacene narudzbe
     * @returns {Promise<number>}
     */
    naruciRecursive: async function (korpa, kupac_id, trgovci, trenutna_narudzba_id) {
        // Provjera da se izadje iz rekurzije zbog infinite loop-a
        if (korpa.length === 0)
        {
            return -1;
        }
        const item = korpa[0];
        let trenutni_id_trgovca = item.idTrgovca;
        // ukoliko smo vec spremili narudzbu za trgovca onda preskacemo dodavanje nove narudzbe
        if (!trgovci.includes(trenutni_id_trgovca))
        {
            await pool.query(`insert into narudzba (kupac_id, trgovina_id, datum)
            values ($1, $2, current_date) returning id`,
                [kupac_id, item.idTrgovca])
                .then(
                    result => {
                        // spasavamo id narudzbe jer nam treba za query narudzba_detalji
                        trenutna_narudzba_id = result.rows[0].id;
                        trgovci.push(trenutni_id_trgovca);
                    }
                )
                .catch(err => console.error('error', err.stack));
        }

        await pool.query(`insert into narudzba_detalji (artikal_id, narudzba_id, kolicina) 
                                            values ($1, $2, $3)`,
            [item.id, trenutna_narudzba_id, item.kolicina])
            .then(() => {
                const index = korpa.indexOf(item);
                if (index > -1) {
                    korpa.splice(index, 1);
                }
            })
            .catch(err => console.error('Insert narudzba_detalji error: ', err));

        await pomocne.naruciRecursive(korpa, kupac_id, trgovci, trenutna_narudzba_id);
    },
}

let db = {
  dobaviArtikleTrgovca: function (req, res, next) {
    pool.query(`select naziv_artikla, opis, cijena from artikal inner join korisnik k on artikal.korisnik = k.id
    where korisnicko_ime = $1;`,
        [jwt.verify(req.cookies.token_prijava, 'kljuc').korisnickoIme],
        (err, result) => {
          //pool.end();
          if (err){
            console.info(err);
            //res.end('{"error" : "Error", "status" : 500}');
            res.sendStatus(err);
          } else {
            //console.info(result.rows);
            req.artikli = result.rows;
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
    unosArtikla: function (req, res, next) {
        var artikal = {
            naziv_artikla: req.body.naziv_artikla,
            opis: req.body.opis,
            kolicina: parseInt(req.body.kolicina),
            cijena: parseInt(req.body.cijena),
            kolicina_prodanog: 0,
            korisnik: jwt.verify(req.cookies.token_prijava, 'kljuc').id,
        }
        console.log(artikal);

        pool.query(`insert into artikal (naziv_artikla, opis, kolicina, cijena, kolicina_prodanog, korisnik)
        VALUES ($1, $2, $3, $4, $5, $6) returning id`,
            [artikal.naziv_artikla, artikal.opis, artikal.kolicina, artikal.cijena, artikal.kolicina_prodanog, artikal.korisnik],
            (err, result) => {
                if (err){
                    console.info('prvi upit', err);
                    res.sendStatus(err);
                } else {
                    var kategorije = JSON.parse("[" + req.body.kategorije + "]");
                    console.log(req.body.kategorije);
                    if(kategorije.length >= 0){
                        var kategorije_artikal = [];
                        for(let i=0; i < kategorije.length; ++i){
                            let element = [];
                            element.push(kategorije[i]);
                            element.push(result.rows[0].id); //
                            kategorije_artikal.push(element);
                            console.log(kategorije_artikal);
                        }
                        let query1 = format('INSERT INTO kategorija_artikal (kategorija, artikal) VALUES %L returning id', kategorije_artikal);
                        console.log(query1);
                        console.log(kategorije_artikal);
                        pool.query(query1,
                            (err, result) => {
                                //pool.end();
                                if (err){
                                    console.info('drugi upit',err);
                                    //res.end('{"error" : "Error", "status" : 500}');
                                    res.sendStatus(err);
                                } else {
                                    //console.info(result.rows);
                                    next();
                                }
                            });
                    }
                }
            });
    },
    promjenaLozinke: function (req, res, next) {
        var lozinka = {
            lozinka: pomocne.kriptuj(req.body.lozinka),
            korisnik: jwt.verify(req.cookies.token_prijava, 'kljuc').id,
        }

        pool.query(`UPDATE korisnik SET lozinka = $1 WHERE id = $2`,
            [lozinka.lozinka, lozinka.korisnik],
            (err, result) => {
                if (err){
                    console.info(err);
                    res.sendStatus(err);
                } else {
                    req.najpopularnijiArtikli = result.rows;
                    next();
                }
            });
    },
    dobaviNajpopularnijiArtikli: function (req, res, next) {
        pool.query(`select * from artikal order by kolicina_prodanog desc limit 5`,
            (err, result) => {
                if (err){
                    console.info(err);
                    res.sendStatus(err);
                } else {
                    req.najpopularnijiArtikli = result.rows;
                    next();
                }
            });
    },
    dobaviSlucajnoOdabraniArtikli: function (req, res, next) {
        pool.query(`select * from artikal`,
            (err, result) => {
                if (err){
                    console.info(err);
                    res.sendStatus(err);
                } else {
                    req.slucajnoOdabraniArtikli = result.rows;
                    next();
                }
            });
    },
    dobaviIntereseKupca: function (req, res, next) {
        pool.query(`select naziv_kategorije from interes inner join kategorija_usluge ku on interes.interes = ku.id
        where kupac=$1`,
            [jwt.verify(req.cookies.token_prijava, 'kljuc').id],
            (err, result) => {
                if (err){
                    console.info(err);
                    res.sendStatus(err);
                } else {
                    let interesiKupca = [];
                    for(let i=0; i<result.rows.length; i++){
                        interesiKupca.push(result.rows[i].naziv_kategorije);
                    }
                    req.interesiKupca = interesiKupca;
                    //console.info(result.rows);
                    //return result.rows;
                    next();
                }
            });
    },
    dobaviArtiklePremaInteresima: function (req, res, next) {

        var inCaluseStr = '(' + Array(req.interesiKupca.length).fill('%L').join(',') + ')';

        var query1 = format.withArray(`select distinct a.id, naziv_artikla, opis, cijena from kategorija_artikal 
        inner join kategorija_usluge ku on ku.id = kategorija_artikal.kategorija
        inner join artikal a on a.id = kategorija_artikal.artikal 
        where naziv_kategorije IN ` + inCaluseStr, req.interesiKupca);
        console.info(query1);

        pool.query(query1,
            (err, result) => {
                //pool.end();
                if (err){
                    console.info(err);
                    //res.end('{"error" : "Error", "status" : 500}');
                    res.sendStatus(err);
                } else {
                    req.artikliPremaInteresima = result.rows;
                    next();
                }
            });
    },
    dobaviArtikal: function (req, res, next) {
        pool.query(`select a.id artikal_id, naziv_artikla, opis, kolicina, cijena, kolicina, korisnik, k.id korisnik_id, 
                    korisnicko_ime, ime, prezime, email, lozinka, tip, telefon, adresa_sjedista from artikal a
                    inner join korisnik k on k.id = a.korisnik
                    where a.id = $1`,
            [req.params.id],
            (err, result) => {
                //pool.end();
                if (err){
                    console.info(err);
                    //res.end('{"error" : "Error", "status" : 500}');
                    res.sendStatus(err);
                } else {
                    console.info(result.rows);
                    req.artikal = result.rows;
                    next();
                }
            });
    },
    aktivnostProfila: function (req, res, next) {
        req.aktivnost = jwt.verify(req.cookies.token_prijava, 'kljuc').aktivnost;
        next();
    },
    dobaviTrgovca: function (req, res, next) {
        pool.query(`select * from korisnik where tip = 2 and korisnicko_ime = $1`,
            [req.params.korisnickoIme],
            (err, result) => {
                //pool.end();
                if (err){
                    console.info(err);
                    //res.end('{"error" : "Error", "status" : 500}');
                    res.sendStatus(err);
                } else {
                    console.info(result.rows);
                    if (result.rows.length < 1){
                        res.redirect('/pretragaTrgovina');
                    } else {
                        req.trgovac = result.rows;
                        next();
                    }
                }
            });
    },
    dobaviArtikleBiloKojegTrgovca: function (req, res, next) {
        pool.query(`select artikal.id, naziv_artikla, opis, cijena from artikal inner join korisnik k on artikal.korisnik = k.id
        where korisnicko_ime = $1;`,
            [req.params.korisnickoIme],
            (err, result) => {
                //pool.end();
                if (err){
                    console.info(err);
                    //res.end('{"error" : "Error", "status" : 500}');
                    res.sendStatus(err);
                } else {
                    //console.info(result.rows);
                    req.artikli = result.rows;
                    console.info(result.rows);
                    next();
                }
            });
    },
    dobaviPodatkeZaUredjivanjeProfila: function (req, res, next) {
        pool.query(`select korisnicko_ime, ime, prezime, email, telefon, adresa_sjedista from korisnik where id = $1`,
            [jwt.verify(req.cookies.token_prijava, 'kljuc').id],
            (err, result) => {
                //pool.end();
                if (err){
                    console.info(err);
                    //res.end('{"error" : "Error", "status" : 500}');
                    res.sendStatus(err);
                } else {
                    //console.info(result.rows);
                    req.podaciKorisnika = result.rows;
                    console.log(req.podaciKorisnika);
                    next();
                }
            });
    },
    dobaviAdresePoslovnice: function (req, res, next) {
        pool.query(`select * from adresa_poslovnice where korisnik = $1`,
            [jwt.verify(req.cookies.token_prijava, 'kljuc').id],
            (err, result) => {
                //pool.end();
                if (err){
                    console.info(err);
                    //res.end('{"error" : "Error", "status" : 500}');
                    res.sendStatus(err);
                } else {
                    //console.info(result.rows);
                    req.adresePoslovnica = result.rows;
                    console.log(req.adresePoslovnica);
                    next();
                }
            });
    },
    urediPodatkeKorisnika: function (req, res, next) {
      broj = null;
      //console.info('tip ', typeof(req.body.broj_telefona));
      if(req.body.broj_telefona !== ""){
          broj = parseInt(req.body.broj_telefona);
      }
        var korisnik = {
            korisnickoIme: req.body.korisnicko_ime,
            ime: req.body.ime,
            prezime: req.body.prezime,
            brojTelefona: broj,
            adresaSjedista: req.body.adresa_sjedista,
            email: req.body.email,
        }
        console.info('kor' + korisnik.brojTelefona);
        pool.query(`update korisnik
                    set korisnicko_ime = $1,
                        ime = $2,
                        prezime = $3,
                        email = $4,
                        telefon = $5,
                        adresa_sjedista = $6
                    where id = $7`,
            [korisnik.korisnickoIme, korisnik.ime, korisnik.prezime,
                korisnik.email, korisnik.brojTelefona, korisnik.adresaSjedista,
                jwt.verify(req.cookies.token_prijava, 'kljuc').id],
            (err, result) => {
                //pool.end();
                if (err){
                    console.info(err);
                    //res.end('{"error" : "Error", "status" : 500}');
                    res.sendStatus(err);
                } else {
                    //console.info(result.rows);
                    req.adresePoslovnice = result.rows;
                    console.log(req.adresePoslovnice);
                    next();
                }
            });
    },
    urediPoslovnicu: function (req, res, next) {
        pool.query(`update adresa_poslovnice
                    set adresa_poslovnice = $1,
                        grad = $2 
                    where id = $3`,
            [req.params.adresa, req.params.grad, req.params.id],
            (err, result) => {
                if (err){
                    console.info(err);
                    return next();
                }
                req.poslovnica = result.rows;
                next();
            });
    },
    obrisiAdresuPoslovnice: function (req, res, next) {
        pool.query(`delete from adresa_poslovnice where id = $1`,
            [parseInt(req.params.id)],
            (err, result) => {
                if (err){
                    console.info(err);
                    return next();
                }
                req.poslovnica = result.rows;
                next();
            });
    },

    dobaviArtiklePretrage: function (req, res, next) {
      const resultsPerPage = 2;

        pool.query(`select * from artikal where naziv_artikla like '%'||$1||'%'`,
            [req.query.q],
            (err, result) => {
                //pool.end();
                if (err){
                    console.info(err);
                    //res.end('{"error" : "Error", "status" : 500}');
                    res.sendStatus(err);
                } else {
                    //console.info(result.rows);
                    const numOfResults = result.rows.length;
                    console.info('numOfResults ' + numOfResults);
                    const numberOfPages = Math.ceil(numOfResults / resultsPerPage);
                    console.info('numberOfPages ' + numberOfPages);

                    let page = req.query.page ? Number(req.query.page) : 1;
                    console.info('page ' + page);

                    if(page > numberOfPages){
                        res.redirect('/artikli?q='+ req.query.q + '&page=' + encodeURIComponent(numberOfPages));
                    } else if (page < 1){
                        res.redirect('/artikli?q='+ req.query.q + '&page=' + encodeURIComponent(1));
                    }

                    const startingLimit = (page - 1) * resultsPerPage;
                    console.info('startingLimit ' + startingLimit);


                    pool.query(`select * from artikal 
                                where naziv_artikla like '%'||$1||'%' 
                                limit $2 offset $3`,
                        [req.query.q, resultsPerPage, startingLimit],
                        (err, result) => {
                            if (err){
                                console.info(err);
                                return next();
                            } else {
                                let iterator = (page - 5) < 1 ? 1 : page - 5;

                                let endingLink = (iterator + 9) <= numberOfPages ?
                                    (iterator + 9) : page + (numberOfPages - page);

                                if(endingLink < (page + 4)){
                                    if(iterator - (page + 4) + numberOfPages < 0){
                                        iterator = 1;
                                    } else {
                                        iterator -= (page + 4) - numberOfPages;
                                    }
                                }
                                console.info('iterator ' + iterator);
                                console.info('endingLink ' + endingLink);


                                req.q = req.query.q;
                                req.numberOfResults = numOfResults;
                                req.page = page;
                                req.iterator = iterator;
                                req.endingLink = endingLink;
                                req.numberOfPages = numberOfPages;
                                req.rezultatiPretrage = result.rows;
                                console.info(req.rezultatiPretrage);
                                next();
                            }
                        });

                }
            });
    },
    dobaviArtikleZaKategoriju: function (req, res, next) {
        const resultsPerPage = 2;

        pool.query(`select * from artikal
            inner join kategorija_artikal ka on artikal.id = ka.artikal
            inner join kategorija_usluge ku on ku.id = ka.kategorija
            where ku.naziv_kategorije = $1`,
            [req.query.q],
            (err, result) => {
                //pool.end();
                if (err){
                    console.info(err);
                    //res.end('{"error" : "Error", "status" : 500}');
                    res.sendStatus(err);
                } else {
                    const numOfResults = result.rows.length;
                    console.info('numOfResults ' + numOfResults);
                    const numberOfPages = Math.ceil(numOfResults / resultsPerPage);
                    console.info('numberOfPages ' + numberOfPages);

                    let page = req.query.page ? Number(req.query.page) : 1;
                    console.info('page ' + page);

                    if(page > numberOfPages){
                        res.redirect('/artikli?q='+ req.query.q + '&page=' + encodeURIComponent(numberOfPages));
                    } else if (page < 1){
                        res.redirect('/artikli?q='+ req.query.q + '&page=' + encodeURIComponent(1));
                    }

                    const startingLimit = (page - 1) * resultsPerPage;
                    console.info('startingLimit ' + startingLimit);

                    pool.query(`select * from artikal
                    inner join kategorija_artikal ka on artikal.id = ka.artikal
                    inner join kategorija_usluge ku on ku.id = ka.kategorija
                    where ku.naziv_kategorije = $1 limit $2 offset $3`,
                        [req.query.q, resultsPerPage, startingLimit],
                        (err, result) => {
                            if (err){
                                console.info(err);
                                return next();
                            } else {
                                let iterator = (page - 5) < 1 ? 1 : page - 5;

                                let endingLink = (iterator + 9) <= numberOfPages ?
                                    (iterator + 9) : page + (numberOfPages - page);

                                if(endingLink < (page + 4)){
                                    if(iterator - (page + 4) + numberOfPages < 0){
                                        iterator = 1;
                                    } else {
                                        iterator -= (page + 4) - numberOfPages;
                                    }
                                }
                                console.info('iterator ' + iterator);
                                console.info('endingLink ' + endingLink);


                                req.q = req.query.q;
                                req.numberOfResults = numOfResults;
                                req.page = page;
                                req.iterator = iterator;
                                req.endingLink = endingLink;
                                req.numberOfPages = numberOfPages;
                                req.rezultatiPretrage = result.rows;
                                console.info(req.rezultatiPretrage);
                                next();
                            }
                        });

                }
            });
    },
    dodajUKorpu: function (req, res, next) {
        pool.query(`select * from artikal where id = $1`,
            [req.params.artikal],
            (err, result) => {
                //pool.end();
                if (err){
                    console.info(err);
                    //res.end('{"error" : "Error", "status" : 500}');
                    res.sendStatus(err);
                } else {
                    //console.info(result.rows);
                    console.log(result.rows)
                    let artikalZaKorpu = {
                        id: req.params.artikal,
                        idTrgovca: result.rows[0].korisnik,
                        naziv: result.rows[0].naziv_artikla,
                        kolicina: 1,
                        cijena: result.rows[0].cijena,
                    }

                    var noviArtikalUKorpi = true;

                    for (let i = 0; i < req.app.locals.korpa.length; i++) {
                        if (req.app.locals.korpa[i].id === artikalZaKorpu.id ){
                            if(req.app.locals.korpa[i].kolicina >= result.rows[0].kolicina){
                                noviArtikalUKorpi = false;
                                break
                            }
                            req.app.locals.korpa[i].kolicina++;
                            noviArtikalUKorpi = false;
                            break;
                        }
                    }

                    if (noviArtikalUKorpi){
                        req.app.locals.korpa.push(artikalZaKorpu);
                    }

                    console.info(req.app.locals.korpa);
                    next();
                }
            });
    },
    azurirajKorpu: function (req, res, next) {
        pool.query(`select * from artikal where id = $1`,
            [req.params.artikal],
            (err, result) => {
                //pool.end();
                if (err){
                    console.info(err);
                    //res.end('{"error" : "Error", "status" : 500}');
                    res.sendStatus(err);
                } else {
                    //console.info(result.rows);
                    for (let i = 0; i < req.app.locals.korpa.length; i++) {

                        if (req.app.locals.korpa[i].id === req.params.artikal ){
                            switch (req.query.akcija){
                                case "dodaj":
                                    if(req.app.locals.korpa[i].kolicina >= result.rows[0].kolicina){
                                        break
                                    }
                                    req.app.locals.korpa[i].kolicina++;
                                    break;
                                case "oduzmi":
                                    req.app.locals.korpa[i].kolicina--;
                                    if (req.app.locals.korpa[i].kolicina < 1){
                                        req.app.locals.korpa.splice(i, 1);
                                    }
                                    break;
                                case "obrisi":
                                    req.app.locals.korpa.splice(i, 1);
                                    break;
                            }
                            break;
                        }
                    }

                    console.info(req.app.locals.korpa);
                    next();
                }
            });
    },
    naruci: async function (req, res, next) {
        var korpa = req.app.locals.korpa;
        let kupac_id = jwt.verify(req.cookies.token_prijava, 'kljuc').id;

        await pomocne.naruciRecursive(korpa, kupac_id, [], -1);
        //var trenutni_id_trgovca = korpa[0].idTrgovca;

/*
                        transporter.sendMail(mailData, function (err, info) {
                            if(err)
                                console.log(err)
                            else
                                console.log(info);
                        });

                    }
                });
 */

        req.app.locals.korpa = [];
        next();
    },

    dobaviNarudzbe: function (req, res, next) {
        pool.query(`select artikal_id, narudzba_id, kolicina, trgovina_id, to_char(datum, 'DD.MM.YYYY') datum, status
                    from narudzba_detalji
                    inner join narudzba n on n.id = narudzba_detalji.narudzba_id
                    where kupac_id = $1
                    order by narudzba_id`,
            [jwt.verify(req.cookies.token_prijava, 'kljuc').id],
            (err, result) => {
                //pool.end();
                if (err){
                    res.sendStatus(err);
                } else {

                    req.narudzbe = result.rows;
                    next();
                }
            });

    },

    otkaziNarudzbu: function (req, res, next) {
        pool.query(`delete from narudzba where id=$1`,
            [req.query.id],
            (err, result) => {
                //pool.end();
                if (err){
                    res.sendStatus(err);
                } else {
                    next();
                }
            });
    },
    dobaviTrgovce: function (req, res, next) {
        pool.query(`select * from korisnik where tip = 2`,
            (err, result) => {
                //pool.end();
                if (err){
                    res.sendStatus(err);
                } else {
                    req.trgovci = result.rows;
                    next();
                }
            });
    },
    dobaviKupce: function (req, res, next) {
        pool.query(`select * from korisnik where tip = 3`,
            (err, result) => {
                //pool.end();
                if (err){
                    res.sendStatus(err);
                } else {
                    req.kupci = result.rows;
                    next();
                }
            });
    },
    arhivirajKorisnika: function (req, res, next) {
        pool.query(`UPDATE korisnik SET aktivnost = 'neaktivan' WHERE id = $1`,
            [req.query.id],
            (err, result) => {
                //pool.end();
                if (err){
                    res.sendStatus(err);
                } else {
                    next();
                }
            });
    },
    blokirajNa15dana: function (req, res, next) {
        pool.query(`UPDATE korisnik SET blokada = now() + interval '15' day  WHERE id=$1;`,
            [req.query.id],
            (err, result) => {
                //pool.end();
                if (err){
                    res.sendStatus(err);
                } else {
                    next();
                }
            });
    },
    brojKorisnika: function (req, res, next) {
        pool.query(`select count(*) from korisnik`,
            (err, result) => {
                //pool.end();
                if (err){
                    res.sendStatus(err);
                } else {
                    req.brojKorisnika = result.rows[0].count;
                    console.log(req.brojKorisnika);
                    next();
                }
            });
    },
    brojKupaca: function (req, res, next) {
        pool.query(`select count(*) from korisnik where tip = 3`,
            (err, result) => {
                //pool.end();
                if (err){
                    res.sendStatus(err);
                } else {
                    req.brojKupaca = result.rows[0].count;
                    next();
                }
            });
    },
    brojTrgovina: function (req, res, next) {
        pool.query(`select count(*) from korisnik where tip = 2`,
            (err, result) => {
                //pool.end();
                if (err){
                    res.sendStatus(err);
                } else {
                    req.brojTrgovina = result.rows[0].count;
                    next();
                }
            });
    },
    brojNarudzbi: function (req, res, next) {
        pool.query(`select count(*) from narudzba`,
            (err, result) => {
                //pool.end();
                if (err){
                    res.sendStatus(err);
                } else {
                    req.brojNarudzbi = result.rows[0].count;
                    next();
                }
            });
    },
    dobaviIdSvihKorisnika: function (req, res, next) {
        pool.query(`select id from korisnik`,
            (err, result) => {
                //pool.end();
                if (err){
                    res.sendStatus(err);
                } else {
                    let idSvihKorisnika = [];
                    for (let i = 0; i < result.rows.length; i++) {
                        idSvihKorisnika.push(result.rows[i].id);
                    }
                    req.idSvihKupaca = idSvihKorisnika;
                    console.log(req.idSvihKupaca);
                    next();
                }
            });
    },
    posaljiPorukuSvimKorisnicima: function (req, res, next) {
        pool.query(`insert into poruka_admina (poruka) values ($1) returning id`,
            [req.body.poruka],
            (err, result) => {
                //pool.end();
                if (err){
                    res.sendStatus(err);
                } else {
                    let poruka_korisnik = [];
                    for (let i = 0; i < req.idSvihKupaca.length; i++) {
                        let element = [];
                        element.push(result.rows[0].id);
                        element.push(req.idSvihKupaca[i]);
                        poruka_korisnik.push(element);
                        console.log(poruka_korisnik);
                    }
                    let query1 = format('insert into poruka_korisnik (poruka_id, korisnik_id) values %L returning id', poruka_korisnik);
                    pool.query(query1,
                        (err, result) => {
                            //pool.end();
                            if (err){
                                //res.end('{"error" : "Error", "status" : 500}');
                                res.sendStatus(err);
                            } else {
                                //console.info(result.rows);
                                next();
                            }
                        });
                }
            });
    },
    dobaviPoruke: function (req, res, next) {
        pool.query(`select * from poruka_admina
                    inner join poruka_korisnik pk on poruka_admina.id = pk.poruka_id
                    where korisnik_id = $1 and vidjeno = 'nije vidjeno'`,
            [jwt.verify(req.cookies.token_prijava, 'kljuc').id],
            (err, result) => {
                //pool.end();
                if (err){
                    res.sendStatus(err);
                } else {
                    req.poruke = result.rows;
                    console.log(req.poruke);
                    next();
                }
            });
    },
    skloniPoruku: function (req, res, next) {
        pool.query(`UPDATE poruka_korisnik
                    SET vidjeno = 'vidjeno'
                    WHERE id=$1`,
            [req.query.id],
            (err, result) => {
            console.log(req.query.id)
                //pool.end();
                if (err){
                    res.sendStatus(err);
                } else {
                    next();
                }
            });
    },


}

/* GET home page. */

router.get('/logout', function(req, res, next) {
    res.clearCookie("token_prijava");
    res.redirect('registracija');
});


router.get('/trgovacProfil',
    db.dobaviArtikleTrgovca,
    db.dobaviPoruke,
    function(req, res, next) {
  res.render('trgovacProfil', {
      title: 'Express',
      artikli: req.artikli,
      korisnik: jwt.verify(req.cookies.token_prijava, 'kljuc'),
      poruke: req.poruke,
  });
});

router.get('/objavaArtiklaUsluge',
    db.dobaviKategorijeUsluga,
    function(req, res, next) {
        res.render('objavaArtiklaUsluge', { title: 'Express', kategorijeUsluga: req.kategorijeUsluga });
    });

router.post('/objavaArtiklaUsluge',
    db.unosArtikla,
    function(req, res, next) {
        res.redirect('/trgovacProfil');
    });

router.get('/uredjivanjeProfila',
    db.dobaviPodatkeZaUredjivanjeProfila,
    db.dobaviAdresePoslovnice,
    function(req, res, next) {
        res.render('uredjivanjeProfila', {
            title: 'Express',
            podaciKorisnika: req.podaciKorisnika,
            adresePoslovnica: req.adresePoslovnica
        });
    });

router.post('/adrese/update/:id/:adresa/:grad',
    db.urediPoslovnicu,
    function(req, res, next) {
        res.sendStatus(200);
    });

router.post('/adrese/obrisi/:id',
    db.obrisiAdresuPoslovnice,
    function(req, res, next) {
        res.sendStatus(200);
    });

router.post('/uredjivanjeProfila',
    db.urediPodatkeKorisnika,
    function(req, res, next) {
        res.redirect('/trgovacProfil');
    });

router.get('/promjenaLozinke',
    function(req, res, next) {
        res.render('promjenaLozinke', { title: 'Express' });
    });

router.post('/promjenaLozinke',
    db.promjenaLozinke,
    function(req, res, next) {
        res.redirect('/trgovacProfil');
    });

router.get('/pocetna',
    db.dobaviKategorijeUsluga,
    db.dobaviNajpopularnijiArtikli,
    db.dobaviSlucajnoOdabraniArtikli,
    db.dobaviIntereseKupca,
    db.dobaviArtiklePremaInteresima,
    db.aktivnostProfila,
    db.dobaviPoruke,
    function(req, res, next) {
        res.render('pocetna', { title: 'Express',
            kategorije: req.kategorijeUsluga,
            najpopularnijiArtikli: req.najpopularnijiArtikli,
            slucajnoOdabraniArtikli: req.slucajnoOdabraniArtikli,
            artikliPremaInteresima: req.artikliPremaInteresima,
            aktivnost: req.aktivnost,
            poruke: req.poruke,
        });
    });

router.get('/artikal/:id',
    db.dobaviArtikal,
    db.aktivnostProfila,
    function(req, res, next) {
        res.render('artikal', {
            title: 'Express',
            artikal: req.artikal,
            aktivnost: req.aktivnost,
        });
    });

router.get('/trgovac/:korisnickoIme',
    db.dobaviTrgovca,
    db.dobaviArtikleBiloKojegTrgovca,
    function(req, res, next) {
        res.render('otvoreniProfilTrgovca', {
            title: 'Express',
            trgovac: req.trgovac,
            artikli: req.artikli });

    });

router.get('/artikli',
    db.dobaviArtiklePretrage,
    function(req, res, next) {
        res.render('rezultatiPretrage', {
            q : req.q,
            numberOfResults: req.numberOfResults,
            page: req.page,
            iterator: req.iterator,
            endingLink: req.endingLink,
            numberOfPages: req.numberOfPages,
            rezultatiPretrage: req.rezultatiPretrage,
        });

    });

router.get('/pretragaTrgovina',
    function(req, res, next) {
        res.render('pretragaTrgovina', {});
    });

router.get('/kategorija',
    db.dobaviArtikleZaKategoriju,
    function(req, res, next) {
        res.render('rezultatiKategorije', {
            title: "kategorije",
            q : req.q,
            numberOfResults: req.numberOfResults,
            page: req.page,
            iterator: req.iterator,
            endingLink: req.endingLink,
            numberOfPages: req.numberOfPages,
            rezultatiPretrage: req.rezultatiPretrage });
    });

router.get('/sveKategorije',
    db.dobaviKategorijeUsluga,
    function(req, res, next) {
        res.render('sveKategorije', {
            kategorije: req.kategorijeUsluga,
        });
    });

router.get('/dodajUKorpu/:artikal',
    db.dodajUKorpu,
    function(req, res, next) {
        res.redirect('/artikal/' + req.params.artikal);
    });

router.get('/korpa',
    pomocne.sortirajArtikleIzKorpe,
    function(req, res, next) {
            console.info(req.app.locals.korpa)
        res.render('korpa', {
            title: 'Korpa',
            korpa: req.app.locals.korpa,
        });
    });

router.get('/korpa/azuriraj/:artikal',
    db.azurirajKorpu,
    function(req, res, next) {
        res.redirect('/korpa');
    });

router.post('/naruci',
    db.naruci,
    function(req, res, next) {
        res.redirect('/pocetna');
    });

router.get('/narudzbe',
    db.dobaviNarudzbe,
    function(req, res, next) {
        res.render('narudzbe',{
            narudzbe: req.narudzbe,
        });
    });

router.post('/otkaziNarudzbu',
    db.otkaziNarudzbu,
    function(req, res, next) {
        res.redirect('/narudzbe');
    });


//administrator
router.get('/administrator',
    db.dobaviTrgovce,
    db.dobaviKupce,
    function(req, res, next) {
        res.render('administrator',{
            title: 'administrator',
            trgovci: req.trgovci,
            kupci: req.kupci,
        });
    });
router.post('/arhiviraj',
    db.arhivirajKorisnika,
    function(req, res, next) {
        res.redirect('administrator');
    });
router.post('/blokirajNa15dana',
    db.blokirajNa15dana,
    function(req, res, next) {
        res.redirect('administrator');
    });

router.get('/statistika',
    db.brojKorisnika,
    db.brojKupaca,
    db.brojTrgovina,
    db.brojNarudzbi,
    function(req, res, next) {
        res.render('statistika',{
            title: 'statistika',
            brojKorisnika: req.brojKorisnika,
            brojKupaca: req.brojKupaca,
            brojTrgovina: req.brojTrgovina,
            brojNarudzbi: req.brojNarudzbi,
        });
    });


router.post('/posaljiPorukuSvimKorisnicima',
    db.dobaviIdSvihKorisnika,
    db.posaljiPorukuSvimKorisnicima,
    function(req, res, next) {
        res.redirect('administrator');
    });

router.post('/skloniPoruku',
    db.skloniPoruku,
    function(req, res, next) {
        res.redirect('/pocetna');
    });

module.exports = router;

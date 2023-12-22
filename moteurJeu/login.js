/*----------------------------------------------------------------------------*\
| On appelle accueil.html en 1er pour construire la page de connexion ws |
| Lorsque la connexion ws est OK, on appelle la page login.html |
| Si le login n'est pas OK, on appelle la page login_nok.html |
| Si le login est OK on appelle la page page1.html |
\*----------------------------------------------------------------------------*/
const http = require('http'); //appelle la bibliotèque http pour créer le serveur
const fs = require('fs');
const PORT = 33333;
var logins = [];
var passwords = [];

var partieLancee = false;

var listeJoueurs = [];
var listeJoueursPrets = [];

var listeClients = [];
var clientSave = '';
function Carte(numero, couleur) {
    this.numero = numero;
    this.couleur = couleur;
}
var cartes = [];
var paquet = [];
var carteJeu;
var tailleMains = [];

var aUnStop = false;
var aUnPlus = false;
var aUnPlus4 = false;
var nbPioche = 0;

var nbVisiteurs = 0;

for (var i = 0; i < 4; i++) {
    var couleurCarte = '';
    switch (i) {
        case 0:
            couleurCarte = 'rouge';
            break;
        case 1:
            couleurCarte = 'bleu';
            break;
        case 2:
            couleurCarte = 'vert';
            break;
        case 3:
            couleurCarte = 'jaune';
            break;
    }
    for (var i2 = 0; i2 < 13; i2++) {
        var nouvelleCarte = new Carte(i2, couleurCarte);
        cartes.push(nouvelleCarte);
        cartes.push(nouvelleCarte);
        paquet.push(nouvelleCarte);
        paquet.push(nouvelleCarte);
    }
    var changementDeCouleur = new Carte(13, 'noir');
    var plusQuatre = new Carte(14, 'noir');
    cartes.push(changementDeCouleur);
    cartes.push(plusQuatre);
    paquet.push(changementDeCouleur);
    paquet.push(plusQuatre);
}
// Chemin vers le fichier texte
const cheminFichier = 'logins.txt';

// Lecture du fichier
fs.readFile(cheminFichier, 'utf8', (erreur, donnees) => {
    if (erreur) {
        console.error(`Erreur de lecture du fichier : ${erreur.message}`);
        return;
    }
    // Traitement des données
    const lignes = donnees.split('\n');
    lignes.forEach((ligne, index) => {
        const [utilisateur, motDePasse] = ligne.split(':');
        logins.push(utilisateur);
        passwords.push(motDePasse);
        console.log(`Ligne ${index + 1} - Utilisateur : ${utilisateur}, Mot de passe : ${motDePasse}`);
    });
});

// Chargement du fichier index.html affiche au client
var server = http.createServer(function (req, res) {
    fs.readFile('./accueil.html', 'utf-8', function (error, content) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(content);
    });
});
// Chargement de la bibliothèque socket.io
const io = require('socket.io')(server);
// détection d'un nouveau client:
io.sockets.on('connection', function (client) {
    var address = client.handshake.address;
    console.log('Nouvelle connexion depuis', address);
    // dès qu'un client se connecte en ws on lui envoie la page login.html
    var contenu = fs.readFileSync("login.html", "UTF-8");
    client.emit('principal', contenu);
    // vérification du login, si OK => page1.html
    client.on('login', (identifiant) => {
        var login = '';
        var pret = false;
        var logsOk = false;

        for (var i = 0; i < logins.length; i++) {
            if (identifiant.login == logins.at(i) && identifiant.passwd == passwords.at(i)) {
                var dejaConnecte = false;
                for(var i2 = 0; i2 < listeJoueurs.length; i2++) {
                    if(logins.at(i) == listeJoueurs.at(i2)) dejaConnecte = true;
                }
                if(dejaConnecte == false && partieLancee == false || identifiant.login == 'visiteur' && partieLancee == false) {
                    login = logins.at(i);
                    if(identifiant.login == 'visiteur') login += '' + ++nbVisiteurs;
                    listeJoueurs.push(login);
                    logsOk = true;
                }
            } 
        }
//---------------------------------------------------------------------------------------------------------//
//--------------------------------------------------Lobby--------------------------------------------------//
//---------------------------------------------------------------------------------------------------------//
        if (logsOk == true) {
            var contenu = fs.readFileSync("lobby.html", "UTF-8");
            client.emit('principal', contenu);
            creationListeJoueurs();

            client.on('disconnect', () => {
                for(var i = 0; i < listeJoueurs.length; i++) {
                    if(listeJoueurs.at(i) == login) listeJoueurs.splice(i, 1);
                }
                for(var i = 0; i < listeJoueursPrets.length; i++) {
                    if(listeJoueursPrets.at(i) == login) listeJoueursPrets.splice(i, 1);
                }
                creationListeJoueurs();
                console.log('Le client', address, "est déconnecté");
            });

            client.on('changementPrepa', function() {
                pret = !pret;
                if(pret == true) listeJoueursPrets.push(login);
                else {
                    for(var i = 0; i < listeJoueursPrets.length; i++) {
                        if(listeJoueursPrets.at(i) == login) listeJoueursPrets.splice(i, 1);
                    }
                }
                if (listeJoueursPrets.length == listeJoueurs.length) {
                    client.emit('startGame');
                    client.broadcast.emit('startGame');
                }
                creationListeJoueurs(); 
                console.log(listeJoueursPrets);
            });
                
//---------------------------------------------------------------------------------------------------------//
//----------------------------------------------Jeu principal----------------------------------------------//
//---------------------------------------------------------------------------------------------------------//

            client.on('start', function() {
                jeu();
                partieLancee = true;
            });

            function jeu() {
                var contenu = fs.readFileSync("clientUno.html", "UTF-8");
                    client.emit('principal', contenu);
        
        
                    listeClients.push(client.id);
                    client.emit('id', client.id);
        
                    clientSave = listeClients.at(0);
        
                    var main = [];
        
                    if (listeClients.length < 2) {
                        do {
                            var nombreAleatoire = Math.floor(Math.random() * paquet.length);
                            carteJeu = paquet[nombreAleatoire];
                        } while (carteJeu.numero > 10);
                        paquet.splice(nombreAleatoire, 1);
                    }
        
                    var stringCarte = carteJeu.numero + ' ' + carteJeu.couleur;
                    client.emit('terrain', stringCarte)
                    client.broadcast.emit('terrain', stringCarte);
        
                    for (var i = 0; i < 7; i++) {
                        pioche();
                    }
        
                    var stringTailles = '';
                    for (var i = 0; i < tailleMains.length; i++) {
                        stringTailles += tailleMains.at(i);
                    }
        
                    // for(var i = 0; i < cartes.length; i++){
                    //     console.log(paquet.at(i));
                    // }

                    tailleMains.splice(emplacementId(), 1);
                    tailleMains.push('Nombre de cartes de ' + login + ' : ' + main.length);
                    stringTailles = '';
                    for (var i = 0; i < tailleMains.length; i++) {
                        stringTailles += tailleMains.at(i) + '<br>';
                    }
                    client.emit('mainA', stringTailles);
                    client.broadcast.emit('mainA', stringTailles);
                    
                    client.on('appel', function (valeur) {
                        if (client.id == clientSave) {
                            var entreeCorrecte = false;
                            for (var i = 0; i < main.length; i++) {
                                var stringMain = main[i].numero + ' ' + main[i].couleur;
                                var stringRecu = '' + valeur;
                                
                                // if(stringRecu.includes('stop') || stringRecu.includes('Stop')) {
                                //     if(stringRecu.includes('rouge')) stringRecu += '10 rouge';
                                //     else if(stringRecu.includes('vert')) stringRecu = '10 vert';
                                //     else if(stringRecu.includes('bleu')) stringRecu = '10 bleu';
                                //     else if(stringRecu.includes('jaune')) stringRecu = '10 jaune';
                                // }
                                // else if(stringRecu.includes('changement de sens') || stringRecu.includes('Changement de sens')) {
                                //     if(stringRecu.includes('rouge')) stringRecu += '11 rouge';
                                //     else if(stringRecu.includes('vert')) stringRecu = '11 vert';
                                //     else if(stringRecu.includes('bleu')) stringRecu = '11 bleu';
                                //     else if(stringRecu.includes('jaune')) stringRecu = '11 jaune';
                                // }
                                // else if(stringRecu.includes('+2') || stringRecu.includes('+2')) {
                                //     if(stringRecu.includes('rouge')) stringRecu += '12 rouge';
                                //     else if(stringRecu.includes('vert')) stringRecu = '12 vert';
                                //     else if(stringRecu.includes('bleu')) stringRecu = '12 bleu';
                                //     else if(stringRecu.includes('jaune')) stringRecu = '12 jaune';
                                // }
                                // else if(stringRecu == 'Changement de couleur' || stringRecu == 'changement de couleur') {
                                //     stringRecu = '13 noir';
                                // }
                                // else if(stringRecu == '+4') {
                                //     stringRecu = '14 noir';
                                // }
                                if (stringRecu == stringMain) {
                                    if (carteJeu.numero == main[i].numero || carteJeu.couleur == main[i].couleur || main[i].couleur == 'noir') {
                                        entreeCorrecte = actionsClic(stringMain, i);
                                    }
                                }
                            }
                            if (entreeCorrecte == false) {
                                client.emit('entreeIncorrecte');
                            }
                            if (main.length === 0) {
                                client.emit('victoire');
                                client.broadcast.emit('defaite', client.id);
                            }
                            else if (main.length === 1) {
                                client.emit('uno', client.id);
                                client.broadcast.emit('uno', client.id);
                            }
                            actualisationContenu();
                        }
                    });
                    client.on('piocher', function () {
                        if (client.id == clientSave) {
                            pioche();
                            finDuTour();
                        }
                    });
        
                    client.on('stop', function () {
                        for (var i = 0; i < main.length; i++) {
                            if (carteJeu.numero == 10 && main[i].numero == carteJeu.numero) {
                                aUnStop = true;
                            }
                            else if (carteJeu.numero == 12 && main[i].numero == carteJeu.numero) {
                                aUnPlus = true;
                            }
                            else if (carteJeu.numero == 14 && main[i].numero == carteJeu.numero) {
                                aUnPlus4 = true;
                            }
                        }
                        if (aUnStop == false && aUnPlus == false && aUnPlus4 == false) {
                            if (carteJeu.numero == 12) {
                                nbPioche += 2;
                                for (var i = 0; i < nbPioche; i++) {
                                    pioche();
                                }
                                nbPioche = 0;
                            }
                            else if (carteJeu.numero == 14) {
                                nbPioche += 4;
                                for (var i = 0; i < nbPioche; i++) {
                                    pioche();
                                }
                                nbPioche = 0;
                            }
                            finDuTour();
                        }
                        else {
                            if (aUnPlus == true) nbPioche += 2;
                            else if (aUnPlus4 == true) nbPioche += 4;
        
                            aUnPlus = false;
                            aUnPlus4 = false;
                            aUnStop = false;
        
                            client.emit('menuStop');
                        }
                    });
        
                    client.on('0Cartes', function (tailleMain, nbJoueurAPasser, idGagnant) {
                        var idG = idGagnant;
                        var tM = tailleMain;
                        if (main.length < tailleMain) {
                            idG = client.id;
                            tM = main.length;
                        }
                        var nbJAP = nbJoueurAPasser - 1;
                        if (nbJAP > 0) {
                            io.to(clientSave).emit('plusDeCartes', tM, nbJAP, idG);
                        }
                        else {
                            client.emit('finPartieCartes', tM, idG);
                            client.broadcast.emit('finPartieCartes', tM, idG);
                            paquet = cartes;
                            partieLancee = false;
                        }
        
                    });
        
                    client.on('couleurChoisie', function (couleur) {
                        var symbole = '';
                        carteJeu.couleur = couleur;
                        // if(carteJeu.numero == 13) symbole = 'Changement de couleur';
                        // else if(carteJeu.numero == 14) symbole = '+4';
                        if(carteJeu.numero == 13) symbole = '13';
                        else if(carteJeu.numero == 14) symbole = '14';
                        stringCarte = symbole + ' ' + carteJeu.couleur;
                        client.emit('terrain', stringCarte)
                        client.broadcast.emit('terrain', stringCarte);
                        finDuTour();
                        if (carteJeu.numero == 14) {
                            io.to(clientSave).emit('desactivation');
                            io.to(clientSave).emit('carteStop');
                        }
                    });
        
                    if (client.id == clientSave) {
                        client.emit('activation');
                        client.broadcast.emit('desactivation');
                        console.log('Activation client ' + client.id);
                    }
                    else {
                        client.emit('desactivation');
                        console.log('Désactivation client ' + client.id);
                    }
        
                    affichageClients();
        
        
        
                    function affichageClients() {
                        console.log('Liste des listeClients :\n')
                        for (var i = 0; i < listeClients.length; i++) {
                            console.log(listeClients.at(i));
                        }
                        console.log('');
                    }
        
                    function emplacementId() {
                        for (var i = 0; i < listeClients.length; i++) {
                            if (listeClients.at(i) == client.id) return i;
                        }
                    }
        
                    function pioche() {
                        if (paquet.length < 1) {
                            io.to(clientSave).emit('plusDeCartes', main.length, listeClients.length, client.id);
                        }
                        else {
                            let nombreAleatoire = Math.floor(Math.random() * paquet.length);
                            main.push(paquet[nombreAleatoire]);
                            paquet.splice(nombreAleatoire, 1);
                            actualisationContenu();
                        }
                    }
        
                    function actualisationContenu() {
                        var contenuMain = "Contenu de la main :\n| ";
                        for (var i = 0; i < main.length; i++) {
                            var symbole = '';
                            // switch(main[i].numero){
                            //     case 10:
                            //         contenuMain += 'Stop' + ' ' + main[i].couleur + " | ";
                            //         break;
                            //     case 11:
                            //         contenuMain += 'Changement de sens' + ' ' + main[i].couleur + " | ";
                            //         break;
                            //     case 12:
                            //         contenuMain += '+2' + ' ' + main[i].couleur + " | ";
                            //         break;
                            //     case 13:
                            //         contenuMain += 'Changement de couleur' + " | ";
                            //         break;
                            //     case 14:
                            //         contenuMain += '+4' + " | ";
                            //         break;
                            //     default:
                            //         contenuMain += main[i].numero + ' ' + main[i].couleur + " | ";
                            // }
                            contenuMain += main[i].numero + ' ' + main[i].couleur + " | ";
                        }
                        client.emit('data', contenuMain);
                    }
        
                    function finDuTour() {
                        listeClients.splice(emplacementId(), 1);
                        listeClients.push(client.id);
                        clientSave = listeClients.at(0);
                        io.to(clientSave).emit('activation');
                        tailleMains.splice(emplacementId(), 1);
                        tailleMains.push('Nombre de cartes de ' + login + ' : ' + main.length);
                        stringTailles = '';
                        for (var i = 0; i < tailleMains.length; i++) {
                            stringTailles += tailleMains.at(i) + '<br>';
                        }
                        client.emit('mainA', stringTailles);
                        client.broadcast.emit('mainA', stringTailles);
                    }
        
                    function actionsClic(stringCarte, i) {
                        carteJeu = main[i];
                        stringCarte = carteJeu.numero + ' ' + carteJeu.couleur;
                        main.splice(i, 1);
                        actualisationContenu();
        
                        client.emit('carteEnJeu', stringCarte);
                        client.broadcast.emit('terrain', stringCarte);
        
                        if (carteJeu.numero == 11) {
                            listeClients.reverse();
                            finDuTour();
                        }
                        else if (carteJeu.numero == 10) {
                            finDuTour();
                            io.to(clientSave).emit('desactivation');
                            io.to(clientSave).emit('carteStop');
                        }
                        else if (carteJeu.numero == 12) {
                            finDuTour();
                            io.to(clientSave).emit('desactivation');
                            io.to(clientSave).emit('carteStop');
                        }
                        else if (carteJeu.numero == 13) {
                            client.emit('choixCouleur');
                        }
                        else if (carteJeu.numero == 14) {
                            client.emit('choixCouleur');
                        }
                        else finDuTour();
        
                        return true;
                    }
        
                    client.on('disconnect', function () {
                        listeClients.splice(emplacementId(), 1);
                        clientSave = listeClients.at(0);
                        for (var i = 0; i < main.length; i++) {
                            paquet.push(main[i]);
                        }
                        io.to(clientSave).emit('activation');
                        console.log(client.id + " déconnecté.");
                    });

            }

            function creationListeJoueurs() {
                var stringJoueurs = '';
                
                for (var i = 0; i < listeJoueurs.length; i++) {
                    if(i > 0) stringJoueurs += `, `;
                    stringJoueurs += listeJoueurs.at(i);
                    for(var i2 = 0; i2 < listeJoueursPrets.length; i2++) {
                        if(listeJoueursPrets.at(i2) == listeJoueurs.at(i)) stringJoueurs += ' (Prêt)';
                    } 
                }
                client.emit('listeJoueurs', stringJoueurs);
                client.broadcast.emit('listeJoueurs', stringJoueurs);
            }
        }

        else {
            var contenu = fs.readFileSync("login_nok.html", "UTF-8");
            client.emit('principal', contenu);
            if(dejaConnecte == true) client.emit('dejaConnecte');
            else if(partieLancee == true) client.emit('partieLancee');
        }
    })
    // Ici quand le client demande une page
    client.on('page', function (page) {
        var contenu = fs.readFileSync(page, "UTF-8");
        client.emit('principal', contenu);
    });
    client.on('disconnect', () => {
        console.log('Le client', address, "est déconnecté");
    });
});
server.listen(PORT);
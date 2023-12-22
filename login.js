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

//Boucle de création du paquet et de la liste de cartes
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
// Chemin vers le fichier texte contenant les identifiants
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

// Chargement du fichier accueil.html affiche au client
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
    // vérification du login, si OK => affichage de la page de lobby
    client.on('login', (identifiant) => {
        var login = '';
        var pret = false;
        var logsOk = false;

        for (var i = 0; i < logins.length; i++) {
            if (identifiant.login == logins.at(i) && identifiant.passwd == passwords.at(i)) {
                var dejaConnecte = false;
                for(var i2 = 0; i2 < listeJoueurs.length; i2++) {
                    if(logins.at(i) == listeJoueurs.at(i2)) dejaConnecte = true; //Vérifie si l'utilisateur est déjà connecté
                }
                if(dejaConnecte == false && partieLancee == false || identifiant.login == 'visiteur' && partieLancee == false) {
                    login = logins.at(i);
                    if(identifiant.login == 'visiteur') login += '' + ++nbVisiteurs;
                    listeJoueurs.push(login); //Ajoute l'utilisateur à une liste des utilisateurs connectés
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

            //Retire l'utilisateur de la liste d'utilisateurs connectés et de la liste d'utilisateurs prêts
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

            //Lorsque l'utilisateur clique sur le bouton pour se préparer, il est ajouté à une liste des utilisateurs prêts s'il n'est pas déjà prêt, dans le cas contraire il est retiré de cette liste
            client.on('changementPrepa', function() {
                pret = !pret;
                if(pret == true) listeJoueursPrets.push(login);
                else { //Si l'utilisateur n'est pas prêt, le retire de la liste
                    for(var i = 0; i < listeJoueursPrets.length; i++) {
                        if(listeJoueursPrets.at(i) == login) listeJoueursPrets.splice(i, 1);
                    }
                }
                if (listeJoueursPrets.length == listeJoueurs.length) { //Si la liste des utilisateurs prêts correspond à celle des utilisateurs connectés : la partie se lance
                    client.emit('startGame');
                    client.broadcast.emit('startGame'); //Envoie à tout les utilisateurs une requête pour lancer le jeu
                }
                creationListeJoueurs(); //Met à jour la chaine d'utilisateurs pour le lobby
                console.log(listeJoueursPrets);
            });
                
//---------------------------------------------------------------------------------------------------------//
//----------------------------------------------Jeu principal----------------------------------------------//
//---------------------------------------------------------------------------------------------------------//

            client.on('start', function() { //Lance le jeu
                jeu();
                partieLancee = true;
            });

            function jeu() { //Ecran de jeu
                //-------Lancement de la partie--------//

                var contenu = fs.readFileSync("clientUno.html", "UTF-8");
                client.emit('principal', contenu);

                //Ajout de l'identifiant du joueur à un tableau
                listeClients.push(client.id);
                client.emit('id', client.id);

                //Stockage du premier élement de ce tableau dans une variable qui servira à indiquer le joueur actif
                clientSave = listeClients.at(0);

                var main = []; //Main du joueur

                //Placement de la carte de départ sur le terrain
                if (listeClients.length < 2) {
                    do {
                        var nombreAleatoire = Math.floor(Math.random() * paquet.length);
                        carteJeu = paquet[nombreAleatoire];
                    } while (carteJeu.numero > 10);
                    paquet.splice(nombreAleatoire, 1);
                }

                //Actualisation du terrain sur le client
                var stringCarte = carteJeu.numero + ' ' + carteJeu.couleur;
                client.emit('terrain', stringCarte)
                client.broadcast.emit('terrain', stringCarte);

                //Pioche les 7 cartes de départ
                for (var i = 0; i < 7; i++) {
                    pioche();
                }

                //Permet d'indiquer le nombre de cartes du joueur aux autres joueurs
                var stringTailles = '';
                for (var i = 0; i < tailleMains.length; i++) {
                    stringTailles += tailleMains.at(i);
                }
                tailleMains.splice(emplacementId(), 1);
                tailleMains.push('Nombre de cartes de ' + login + ' : ' + main.length);
                stringTailles = '';
                for (var i = 0; i < tailleMains.length; i++) {
                    stringTailles += tailleMains.at(i) + '<br>';
                }
                client.emit('mainA', stringTailles);
                client.broadcast.emit('mainA', stringTailles);

                //Activation et désactivation des affichages clients selon si c'est le tour de l'utilisateur ou non
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

                //-------Actions du joueur-------//

                //Quand le joueur clique sur le bouton pour placer une carte
                client.on('appel', function (valeur) {
                    if (client.id == clientSave) { //On vérifie si le joueur est bien le joueur actif
                        var entreeCorrecte = false;
                        for (var i = 0; i < main.length; i++) {
                            var stringMain = main[i].numero + ' ' + main[i].couleur;
                            var stringRecu = '' + valeur;

                            //Vérifie si le texte entré par l'utilisateur correspond à une carte de sa main et à celle sur le terrain puis effectue les actions de pose de carte (actionClic())
                            if (stringRecu == stringMain) {
                                if (carteJeu.numero == main[i].numero || carteJeu.couleur == main[i].couleur || main[i].couleur == 'noir') {
                                    entreeCorrecte = actionsClic(stringMain, i);
                                }
                            }
                        }
                        //Si l'entrée est incorrecte, un texte s'affiche pour le client
                        if (entreeCorrecte == false) { 
                            client.emit('entreeIncorrecte');
                        }
                        //Si la main est vide après le clic, le joueur gagne
                        if (main.length === 0) {
                            client.emit('victoire');
                            client.broadcast.emit('defaite', client.id);
                        }
                        //S'il n'y plus qu'une carte dans la main, le uno est déclaré à tout les joueurs
                        else if (main.length === 1) {
                            client.emit('uno', client.id);
                            client.broadcast.emit('uno', client.id);
                        }
                        //Met à jour le contenu de la main sur l'interface utilisateur
                        actualisationContenu();
                    }
                });
                //Quand le joueur clique sur le bouton pour piocher
                client.on('piocher', function () {
                    if (client.id == clientSave) {
                        pioche();
                        finDuTour();
                    }
                });
                //Quand le joueur possède une carte stop, +2 ou +4
                client.on('stop', function () {
                    //On vérfie quel type de carte est sur le terrain et si le joueur a une carte du même type dans sa main
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
                    //S'il n'a pas le même type de carte, on effectue la pioche et la fin de tour correspondant à la carte
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
                    else { //Si le joueur a une carte du même type que celle sur le terrain
                        //Cette condition prend en charge l'addition des +2 et +4
                        if (aUnPlus == true) nbPioche += 2; 
                        else if (aUnPlus4 == true) nbPioche += 4; 

                        aUnPlus = false;
                        aUnPlus4 = false;
                        aUnStop = false;

                        //Lance le menu spécial pour poser la carte correspondante
                        client.emit('menuStop');
                    }
                });
                //Boucle de requêtes servant à chercher l'utilisateur avec le moins de carte lorsque le paquet est vide
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
                //Quand le joueur a choisi sa couleur après avoir posé une carte de changement de couleur
                client.on('couleurChoisie', function (couleur) {
                    //Change la couleur de la carte sur le terrain et modifie l'interface utilisateur
                    carteJeu.couleur = couleur;
                    stringCarte = carteJeu.numero + ' ' + carteJeu.couleur;
                    client.emit('terrain', stringCarte)
                    client.broadcast.emit('terrain', stringCarte);
                    finDuTour();
                    if (carteJeu.numero == 14) { //Si la carte est un +2, on lance la succession d'actions en lien avec la règle d'empilement de Stop/+2/+4
                        io.to(clientSave).emit('desactivation');
                        io.to(clientSave).emit('carteStop');
                    }
                });


                //Afficher les utilisateurs connectés dans la console
                function affichageClients() {
                    console.log('Liste des listeClients :\n')
                    for (var i = 0; i < listeClients.length; i++) {
                        console.log(listeClients.at(i));
                    }
                    console.log('');
                }

                //Retourne l'emplacement dans la liste des clients du joueur
                function emplacementId() {
                    for (var i = 0; i < listeClients.length; i++) {
                        if (listeClients.at(i) == client.id) return i;
                    }
                }

                //Gère la pioche d'une carte
                function pioche() {
                    if (paquet.length < 1) {//S'il n'y a plus de cartes dans le paquet, lance la boucle de requête pour trouver qui est le joueur avec le moins de cartes
                        io.to(clientSave).emit('plusDeCartes', main.length, listeClients.length, client.id);
                    }
                    else {//Prend une carte aléatoirement dans le paquet, l'ajoute à la main du joueur puis la retire du paquet
                        let nombreAleatoire = Math.floor(Math.random() * paquet.length);
                        main.push(paquet[nombreAleatoire]);
                        paquet.splice(nombreAleatoire, 1);
                        actualisationContenu();
                    }
                }
                //Met à jour le contenu de la main sur l'interface utilisateur
                function actualisationContenu() {
                    var contenuMain = "Contenu de la main :\n| ";
                    for (var i = 0; i < main.length; i++) {
                        contenuMain += main[i].numero + ' ' + main[i].couleur + " | ";
                    }
                    client.emit('data', contenuMain);
                }
                //Gère les actions de changement de tour ainsi que la mise à jour du nombre de cartes du joueur pour l'interface des autres joueurs
                function finDuTour() {
                    //Retire l'utilisateur du tableau et le replace à la fin
                    listeClients.splice(emplacementId(), 1);
                    listeClients.push(client.id);
                    clientSave = listeClients.at(0); //Enregistre le nouveau premier element du tableau en tant que joueur actif
                    io.to(clientSave).emit('activation'); //Active l'interface utilisateur du nouveau joueur actif
                    //Gestion de l'affichage du nombre de cartes
                    tailleMains.splice(emplacementId(), 1);
                    tailleMains.push('Nombre de cartes de ' + login + ' : ' + main.length);
                    stringTailles = '';
                    for (var i = 0; i < tailleMains.length; i++) {
                        stringTailles += tailleMains.at(i) + '<br>';
                    }
                    client.emit('mainA', stringTailles);
                    client.broadcast.emit('mainA', stringTailles);
                }
                //Gère toutes les actions à la pose d'une carte
                function actionsClic(stringCarte, i) {
                    //Remplace la carte sur le terrain par la carte du joueur et met à jour l'interface utilisateur
                    carteJeu = main[i];
                    stringCarte = carteJeu.numero + ' ' + carteJeu.couleur;
                    main.splice(i, 1);
                    actualisationContenu();

                    client.emit('carteEnJeu', stringCarte);
                    client.broadcast.emit('terrain', stringCarte);

                    //Si la carte est un changement de sens, inverse l'ordre de jeu
                    if (carteJeu.numero == 11) {
                        listeClients.reverse();
                        finDuTour();
                    }
                    //Si la carte est un stop, lance la succession d'actions en lien avec la règle d'empilement de Stop
                    else if (carteJeu.numero == 10) {
                        finDuTour();
                        io.to(clientSave).emit('desactivation');
                        io.to(clientSave).emit('carteStop');
                    }
                    //Si la carte est un +2, lance la succession d'actions en lien avec la règle d'empilement de +2
                    else if (carteJeu.numero == 12) {
                        finDuTour();
                        io.to(clientSave).emit('desactivation');
                        io.to(clientSave).emit('carteStop');
                    }
                    //Si la carte est un changement de sens, active l'interface de choix de couleur pour l'utilisateur
                    else if (carteJeu.numero == 13 || carteJeu.numero == 14) {
                        client.emit('choixCouleur');
                    }
                    else finDuTour();

                    return true;
                }

                //Retire le joueur de la liste de joueurs lorsqu'il se déconnecte et remets ses cartes dans le paquet
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

            //Créé la liste de joueurs qui s'affiche dans le lobby
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

        //Si les informations de connexion fournies par l'utilisateur sont incorrectes, on lui affiche une message
        else {
            var contenu = fs.readFileSync("login_nok.html", "UTF-8");
            client.emit('principal', contenu);
            if(dejaConnecte == true) client.emit('dejaConnecte');
            else if(partieLancee == true) client.emit('partieLancee');
        }
    })
    client.on('disconnect', () => {
        console.log('Le client', address, "est déconnecté");
    });
});
server.listen(PORT);
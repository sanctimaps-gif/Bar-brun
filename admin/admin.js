/* =============================================================
   Espace d'administration — horaires, carte, événements.

   Le contenu est chargé depuis /api/contenu, modifié en mémoire,
   puis renvoyé en bloc à l'enregistrement.
   ============================================================= */

(function () {
  'use strict';

  var JOURS = window.Horaires.JOURS_AFFICHES;
  var ETIQUETTES = [
    { id: 'local', libelle: 'Local' },
    { id: 'sans-alcool', libelle: 'Sans alcool' },
    { id: 'vegan', libelle: 'Végétal' },
    { id: 'nouveau', libelle: 'Nouveau' },
  ];

  var contenu = null;      // le contenu en cours de modification
  var reference = '';      // sa version enregistrée, pour détecter les changements

  var $ = function (sel) { return document.querySelector(sel); };

  /* ---------------------------------------------------------------
   * Fabrique d'éléments
   * ------------------------------------------------------------- */

  function el(balise, options, enfants) {
    var noeud = document.createElement(balise);
    options = options || {};

    if (options.classe) noeud.className = options.classe;
    if (options.texte != null) noeud.textContent = options.texte;
    Object.keys(options.attrs || {}).forEach(function (cle) {
      if (options.attrs[cle] != null) noeud.setAttribute(cle, options.attrs[cle]);
    });
    Object.keys(options.props || {}).forEach(function (cle) {
      noeud[cle] = options.props[cle];
    });
    if (options.sur) {
      Object.keys(options.sur).forEach(function (evt) {
        noeud.addEventListener(evt, options.sur[evt]);
      });
    }
    (enfants || []).forEach(function (enfant) {
      if (enfant) noeud.appendChild(enfant);
    });
    return noeud;
  }

  /** Champ étiqueté générique ; « surSaisie » reçoit la valeur à chaque frappe. */
  function champ(libelle, valeur, surSaisie, options) {
    options = options || {};
    var id = 'champ-' + Math.random().toString(36).slice(2, 9);

    var saisie = el(options.multiligne ? 'textarea' : 'input', {
      attrs: {
        id: id,
        type: options.multiligne ? null : (options.type || 'text'),
        step: options.step,
        min: options.min,
        max: options.max,
        rows: options.multiligne ? (options.lignes || 2) : null,
        placeholder: options.exemple || null,
      },
      props: { value: valeur == null ? '' : valeur },
      sur: {
        input: function () { surSaisie(saisie.value); marquerModifie(); },
      },
    });

    return el('div', { classe: 'champ' + (options.classe ? ' ' + options.classe : '') }, [
      el('label', { texte: libelle, attrs: { for: id } }),
      saisie,
    ]);
  }

  function boutonMini(texte, action, options) {
    options = options || {};
    return el('button', {
      classe: 'mini' + (options.danger ? ' mini--danger' : ''),
      texte: texte,
      attrs: { type: 'button', title: options.titre || null },
      sur: { click: action },
    });
  }

  function vider(noeud) {
    while (noeud.firstChild) noeud.removeChild(noeud.firstChild);
  }

  /* ---------------------------------------------------------------
   * Suivi des modifications
   * ------------------------------------------------------------- */

  function marquerModifie() {
    var etat = $('#etat');
    if (JSON.stringify(contenu) === reference) {
      etat.dataset.etat = '';
      etat.textContent = 'Aucune modification en attente.';
    } else {
      etat.dataset.etat = 'modifie';
      etat.textContent = 'Modifications non enregistrées.';
    }
  }

  function messageEtat(texte, type) {
    var etat = $('#etat');
    etat.dataset.etat = type || '';
    etat.textContent = texte;
  }

  window.addEventListener('beforeunload', function (evt) {
    if (contenu && JSON.stringify(contenu) !== reference) {
      evt.preventDefault();
      evt.returnValue = '';
    }
  });

  /* ---------------------------------------------------------------
   * Panneau : horaires
   * ------------------------------------------------------------- */

  function rendreHoraires() {
    var zone = $('#jours');
    vider(zone);

    JOURS.forEach(function (jour) {
      var plages = contenu.horaires[jour] || [];
      var ouvert = plages.length > 0;

      var lignes = el('div', { classe: 'jour__plages' });

      plages.forEach(function (plage, index) {
        lignes.appendChild(el('div', { classe: 'jour__plage' }, [
          el('span', { texte: 'de' }),
          el('input', {
            attrs: { type: 'time', 'aria-label': 'Ouverture ' + jour },
            props: { value: plage.ouverture },
            sur: { input: function (e) { plage.ouverture = e.target.value; marquerModifie(); } },
          }),
          el('span', { texte: 'à' }),
          el('input', {
            attrs: { type: 'time', 'aria-label': 'Fermeture ' + jour },
            props: { value: plage.fermeture },
            sur: { input: function (e) { plage.fermeture = e.target.value; marquerModifie(); } },
          }),
          plages.length > 1
            ? boutonMini('Retirer', function () {
                plages.splice(index, 1);
                marquerModifie();
                rendreHoraires();
              }, { danger: true })
            : null,
        ]));
      });

      if (!ouvert) {
        lignes.appendChild(el('span', { classe: 'vide', texte: 'Fermé toute la journée' }));
      }

      var interrupteur = el('label', { classe: 'interrupteur' }, [
        el('input', {
          attrs: { type: 'checkbox' },
          props: { checked: ouvert },
          sur: {
            change: function (e) {
              contenu.horaires[jour] = e.target.checked
                ? [{ ouverture: '16:00', fermeture: '02:00' }]
                : [];
              marquerModifie();
              rendreHoraires();
            },
          },
        }),
        el('span', { texte: jour.charAt(0).toUpperCase() + jour.slice(1) }),
      ]);

      zone.appendChild(el('div', {
        classe: 'jour',
        attrs: { 'data-ferme': ouvert ? 'false' : 'true' },
      }, [
        interrupteur,
        lignes,
        ouvert
          ? boutonMini('+ Créneau', function () {
              plages.push({ ouverture: '12:00', fermeture: '14:00' });
              marquerModifie();
              rendreHoraires();
            }, { titre: 'Ajouter un second service dans la journée' })
          : el('span'),
      ]));
    });

    rendreHappyHour();
    rendreFermetures();
  }

  function rendreHappyHour() {
    var zone = $('#happy-hour');
    vider(zone);

    if (!contenu.happyHour) {
      contenu.happyHour = { actif: false, jours: [], debut: '17:00', fin: '19:00', texte: '' };
    }
    var hh = contenu.happyHour;

    zone.appendChild(el('label', { classe: 'interrupteur' }, [
      el('input', {
        attrs: { type: 'checkbox' },
        props: { checked: !!hh.actif },
        sur: {
          change: function (e) { hh.actif = e.target.checked; marquerModifie(); rendreHappyHour(); },
        },
      }),
      el('span', { texte: 'Afficher l\'happy hour sur le site' }),
    ]));

    if (!hh.actif) return;

    zone.appendChild(el('div', { classe: 'grille', attrs: { style: 'margin-top:1rem' } }, [
      champ('Début', hh.debut, function (v) { hh.debut = v; }, { type: 'time' }),
      champ('Fin', hh.fin, function (v) { hh.fin = v; }, { type: 'time' }),
    ]));

    zone.appendChild(champ('Texte affiché', hh.texte, function (v) { hh.texte = v; },
      { classe: 'champ--pleine', exemple: 'Pinte à 5 € et cocktails à 7 €' }));

    var choix = el('div', { classe: 'etiquettes-choix' });
    JOURS.forEach(function (jour) {
      choix.appendChild(el('label', { classe: 'interrupteur' }, [
        el('input', {
          attrs: { type: 'checkbox' },
          props: { checked: (hh.jours || []).indexOf(jour) !== -1 },
          sur: {
            change: function (e) {
              hh.jours = hh.jours || [];
              if (e.target.checked) {
                if (hh.jours.indexOf(jour) === -1) hh.jours.push(jour);
              } else {
                hh.jours = hh.jours.filter(function (j) { return j !== jour; });
              }
              marquerModifie();
            },
          },
        }),
        el('span', { texte: jour }),
      ]));
    });
    zone.appendChild(el('div', {}, [el('p', { classe: 'panneau__intro', texte: 'Jours concernés :' }), choix]));
  }

  function rendreFermetures() {
    var zone = $('#fermetures');
    vider(zone);

    contenu.fermetures = contenu.fermetures || [];

    if (!contenu.fermetures.length) {
      zone.appendChild(el('p', { classe: 'vide', texte: 'Aucune fermeture exceptionnelle prévue.' }));
      return;
    }

    contenu.fermetures.forEach(function (f, index) {
      zone.appendChild(el('div', { classe: 'element' }, [
        el('div', { classe: 'element__entete' }, [
          el('p', { classe: 'element__titre', texte: f.motif || 'Fermeture' }),
          el('div', { classe: 'element__outils' }, [
            boutonMini('Supprimer', function () {
              contenu.fermetures.splice(index, 1);
              marquerModifie();
              rendreFermetures();
            }, { danger: true }),
          ]),
        ]),
        el('div', { classe: 'grille' }, [
          champ('Du', f.du, function (v) { f.du = v; }, { type: 'date' }),
          champ('Au (inclus)', f.au || f.du, function (v) { f.au = v; }, { type: 'date' }),
          champ('Motif', f.motif, function (v) { f.motif = v; }, { exemple: 'Congés d\'été' }),
        ]),
      ]));
    });
  }

  /* ---------------------------------------------------------------
   * Panneau : la carte
   * ------------------------------------------------------------- */

  function rendreCarte() {
    $('#note-carte').value = contenu.noteCarte || '';

    var zone = $('#categories');
    vider(zone);

    if (!contenu.carte.length) {
      zone.appendChild(el('p', { classe: 'vide', texte: 'La carte est vide. Ajoutez une première catégorie.' }));
      return;
    }

    contenu.carte.forEach(function (groupe, index) {
      zone.appendChild(rendreCategorie(groupe, index));
    });
  }

  function rendreCategorie(groupe, index) {
    var articles = el('div', { classe: 'articles-admin' });

    (groupe.articles || []).forEach(function (article, i) {
      articles.appendChild(rendreArticle(groupe, article, i));
    });

    return el('div', { classe: 'element' }, [
      el('div', { classe: 'element__entete' }, [
        el('p', { classe: 'element__titre', texte: groupe.titre || 'Catégorie' }),
        el('div', { classe: 'element__outils' }, [
          boutonMini('↑', function () { deplacer(contenu.carte, index, -1); rendreCarte(); },
            { titre: 'Monter' }),
          boutonMini('↓', function () { deplacer(contenu.carte, index, 1); rendreCarte(); },
            { titre: 'Descendre' }),
          boutonMini('Supprimer', function () {
            if (!confirm('Supprimer la catégorie « ' + groupe.titre +' » et tous ses articles ?')) return;
            contenu.carte.splice(index, 1);
            marquerModifie();
            rendreCarte();
          }, { danger: true }),
        ]),
      ]),

      el('div', { classe: 'grille' }, [
        champ('Titre', groupe.titre, function (v) {
          groupe.titre = v;
        }, { exemple: 'Bières pression' }),
        champ('Identifiant (lettres minuscules et tirets)', groupe.id, function (v) {
          groupe.id = v;
        }, { exemple: 'bieres' }),
      ]),

      champ('Note de la catégorie (facultatif)', groupe.note, function (v) { groupe.note = v; },
        { classe: 'champ--pleine', exemple: 'Six becs, dont deux qui tournent.' }),

      articles,

      boutonMini('+ Ajouter un article', function () {
        groupe.articles = groupe.articles || [];
        groupe.articles.push({ nom: '', description: '', prix: { 'verre': 5 }, etiquettes: [] });
        marquerModifie();
        rendreCarte();
      }),
    ]);
  }

  function rendreArticle(groupe, article, index) {
    var prixLignes = el('div', { classe: 'prix-lignes' });
    var formats = Object.keys(article.prix || {});

    formats.forEach(function (format) {
      var champFormat = el('input', {
        attrs: { type: 'text', 'aria-label': 'Format' },
        props: { value: format },
        sur: {
          change: function (e) {
            var nouveau = e.target.value.trim();
            if (!nouveau || nouveau === format) return;
            // Reconstruit l'objet pour conserver l'ordre des formats.
            var recree = {};
            Object.keys(article.prix).forEach(function (cle) {
              recree[cle === format ? nouveau : cle] = article.prix[cle];
            });
            article.prix = recree;
            marquerModifie();
            rendreCarte();
          },
        },
      });

      var champPrix = el('input', {
        attrs: { type: 'number', step: '0.10', min: '0', 'aria-label': 'Prix en euros' },
        props: { value: article.prix[format] },
        sur: {
          input: function (e) {
            var valeur = parseFloat(e.target.value);
            article.prix[format] = isNaN(valeur) ? e.target.value : Math.round(valeur * 100) / 100;
            marquerModifie();
          },
        },
      });

      prixLignes.appendChild(el('div', { classe: 'prix-ligne' }, [
        champFormat,
        champPrix,
        el('span', { texte: '€' }),
        formats.length > 1
          ? boutonMini('×', function () {
              delete article.prix[format];
              marquerModifie();
              rendreCarte();
            }, { danger: true, titre: 'Retirer ce format' })
          : null,
      ]));
    });

    var etiquettes = el('div', { classe: 'etiquettes-choix' });
    ETIQUETTES.forEach(function (etq) {
      etiquettes.appendChild(el('label', { classe: 'interrupteur' }, [
        el('input', {
          attrs: { type: 'checkbox' },
          props: { checked: (article.etiquettes || []).indexOf(etq.id) !== -1 },
          sur: {
            change: function (e) {
              article.etiquettes = article.etiquettes || [];
              if (e.target.checked) {
                if (article.etiquettes.indexOf(etq.id) === -1) article.etiquettes.push(etq.id);
              } else {
                article.etiquettes = article.etiquettes.filter(function (x) { return x !== etq.id; });
              }
              marquerModifie();
            },
          },
        }),
        el('span', { texte: etq.libelle }),
      ]));
    });

    return el('div', { classe: 'article-admin' }, [
      el('div', { classe: 'element__entete' }, [
        el('strong', { texte: article.nom || 'Nouvel article' }),
        el('div', { classe: 'element__outils' }, [
          boutonMini('↑', function () { deplacer(groupe.articles, index, -1); rendreCarte(); }, { titre: 'Monter' }),
          boutonMini('↓', function () { deplacer(groupe.articles, index, 1); rendreCarte(); }, { titre: 'Descendre' }),
          boutonMini('Supprimer', function () {
            groupe.articles.splice(index, 1);
            marquerModifie();
            rendreCarte();
          }, { danger: true }),
        ]),
      ]),

      el('div', { classe: 'grille' }, [
        champ('Nom', article.nom, function (v) { article.nom = v; }, { exemple: 'Blonde de la maison' }),
        champ('Description', article.description, function (v) { article.description = v; },
          { exemple: 'Brassée à Rouen, légère et sèche.' }),
      ]),

      el('p', { classe: 'panneau__intro', texte: 'Formats et prix :',
        attrs: { style: 'margin:.8rem 0 .4rem' } }),
      prixLignes,
      boutonMini('+ Ajouter un format', function () {
        article.prix = article.prix || {};
        article.prix['nouveau format'] = 5;
        marquerModifie();
        rendreCarte();
      }),
      etiquettes,
    ]);
  }

  /* ---------------------------------------------------------------
   * Panneau : agenda
   * ------------------------------------------------------------- */

  function rendreAgenda() {
    var zone = $('#evenements');
    vider(zone);

    if (!contenu.agenda.length) {
      zone.appendChild(el('p', { classe: 'vide', texte: 'Aucun événement programmé.' }));
    }

    contenu.agenda.forEach(function (evenement, index) {
      zone.appendChild(el('div', { classe: 'element' }, [
        el('div', { classe: 'element__entete' }, [
          el('p', { classe: 'element__titre', texte: evenement.titre || 'Nouvel événement' }),
          el('div', { classe: 'element__outils' }, [
            boutonMini('Supprimer', function () {
              contenu.agenda.splice(index, 1);
              marquerModifie();
              rendreAgenda();
            }, { danger: true }),
          ]),
        ]),

        champ('Titre', evenement.titre, function (v) { evenement.titre = v; },
          { classe: 'champ--pleine', exemple: 'Concert — trio jazz' }),

        el('div', { classe: 'grille' }, [
          champ('Date', evenement.date, function (v) { evenement.date = v; }, { type: 'date' }),
          champ('Début', evenement.debut, function (v) { evenement.debut = v; }, { type: 'time' }),
          champ('Fin', evenement.fin, function (v) { evenement.fin = v; }, { type: 'time' }),
          champ('Tarif', evenement.prix, function (v) { evenement.prix = v; }, { exemple: 'Entrée libre' }),
        ]),

        champ('Description', evenement.description, function (v) { evenement.description = v; },
          { classe: 'champ--pleine', multiligne: true, exemple: 'Standards et compositions. Chapeau à la fin.' }),
      ]));
    });

    rendreRituels();
  }

  function rendreRituels() {
    var zone = $('#rituels');
    vider(zone);

    contenu.rituels = contenu.rituels || [];

    if (!contenu.rituels.length) {
      zone.appendChild(el('p', { classe: 'vide', texte: 'Aucun rendez-vous régulier.' }));
      return;
    }

    contenu.rituels.forEach(function (rituel, index) {
      zone.appendChild(el('div', { classe: 'element' }, [
        el('div', { classe: 'grille' }, [
          champ('Quand', rituel.quand, function (v) { rituel.quand = v; }, { exemple: 'Jeudi' }),
          champ('Quoi', rituel.quoi, function (v) { rituel.quoi = v; },
            { exemple: 'Concert à partir de 20 h 30.' }),
        ]),
        el('div', { classe: 'element__outils', attrs: { style: 'margin-top:.6rem' } }, [
          boutonMini('Supprimer', function () {
            contenu.rituels.splice(index, 1);
            marquerModifie();
            rendreRituels();
          }, { danger: true }),
        ]),
      ]));
    });
  }

  /* ---------------------------------------------------------------
   * Outils communs
   * ------------------------------------------------------------- */

  function deplacer(liste, index, sens) {
    var cible = index + sens;
    if (cible < 0 || cible >= liste.length) return;
    var element = liste.splice(index, 1)[0];
    liste.splice(cible, 0, element);
    marquerModifie();
  }

  function toutRendre() {
    rendreHoraires();
    rendreCarte();
    rendreAgenda();
    marquerModifie();
  }

  /* ---------------------------------------------------------------
   * Communication avec le serveur
   * ------------------------------------------------------------- */

  function appeler(chemin, options) {
    options = options || {};
    return fetch(chemin, {
      method: options.methode || 'GET',
      headers: { 'Content-Type': 'application/json', 'X-Cafe-Brun': '1' },
      body: options.corps ? JSON.stringify(options.corps) : undefined,
    }).then(function (reponse) {
      if (reponse.status === 401) {
        window.location.href = '/admin';
        throw new Error('Session expirée.');
      }
      return reponse.json().then(function (donnees) {
        return { ok: reponse.ok, statut: reponse.status, donnees: donnees };
      });
    });
  }

  function charger() {
    appeler('/api/contenu').then(function (r) {
      if (!r.ok) throw new Error(r.donnees.erreur || 'Chargement impossible.');
      contenu = r.donnees.contenu;
      contenu.carte = contenu.carte || [];
      contenu.agenda = contenu.agenda || [];
      reference = JSON.stringify(contenu);
      toutRendre();
    }).catch(function (e) {
      messageEtat(e.message, 'erreur');
    });
  }

  function enregistrer() {
    var bouton = $('#bouton-enregistrer');
    var listeErreurs = $('#erreurs');

    bouton.disabled = true;
    listeErreurs.hidden = true;
    vider(listeErreurs);
    messageEtat('Enregistrement…');

    appeler('/api/contenu', { methode: 'PUT', corps: { contenu: contenu } })
      .then(function (r) {
        if (r.statut === 422) {
          messageEtat('Le contenu comporte ' + r.donnees.erreurs.length + ' erreur(s) : rien n\'a été enregistré.', 'erreur');
          r.donnees.erreurs.forEach(function (erreur) {
            listeErreurs.appendChild(el('li', { texte: '· ' + erreur }));
          });
          listeErreurs.hidden = false;
          return;
        }
        if (!r.ok) throw new Error(r.donnees.erreur || 'Enregistrement impossible.');

        reference = JSON.stringify(contenu);
        // Rafraîchit les titres affichés dans les en-têtes de blocs.
        toutRendre();
        messageEtat('Enregistré. Le site public est à jour.', 'enregistre');
      })
      .catch(function (e) {
        messageEtat(e.message, 'erreur');
      })
      .finally(function () {
        bouton.disabled = false;
      });
  }

  /* ---------------------------------------------------------------
   * Branchements
   * ------------------------------------------------------------- */

  function brancherOnglets() {
    var onglets = Array.prototype.slice.call(document.querySelectorAll('.onglet'));
    onglets.forEach(function (onglet) {
      onglet.addEventListener('click', function () {
        onglets.forEach(function (autre) {
          var actif = autre === onglet;
          autre.setAttribute('aria-selected', actif ? 'true' : 'false');
          $('#panneau-' + autre.dataset.panneau).hidden = !actif;
        });
      });
    });
  }

  function brancherAjouts() {
    document.querySelectorAll('[data-ajouter]').forEach(function (bouton) {
      bouton.addEventListener('click', function () {
        switch (bouton.dataset.ajouter) {
          case 'fermeture':
            var aujourdhui = new Date().toISOString().slice(0, 10);
            contenu.fermetures.push({ du: aujourdhui, au: aujourdhui, motif: '' });
            rendreFermetures();
            break;
          case 'categorie':
            contenu.carte.push({ id: 'categorie-' + (contenu.carte.length + 1), titre: 'Nouvelle catégorie', articles: [] });
            rendreCarte();
            break;
          case 'evenement':
            contenu.agenda.push({ titre: '', date: new Date().toISOString().slice(0, 10), debut: '20:30', fin: '', prix: 'Entrée libre', description: '' });
            rendreAgenda();
            break;
          case 'rituel':
            contenu.rituels.push({ quand: '', quoi: '' });
            rendreRituels();
            break;
        }
        marquerModifie();
      });
    });
  }

  function brancherMotDePasse() {
    var dialogue = $('#dialogue-motdepasse');
    var retour = $('#mdp-retour');

    $('#bouton-motdepasse').addEventListener('click', function () {
      retour.hidden = true;
      $('#formulaire-motdepasse').reset();
      dialogue.showModal();
    });

    $('#mdp-annuler').addEventListener('click', function () { dialogue.close(); });

    $('#formulaire-motdepasse').addEventListener('submit', function (evt) {
      evt.preventDefault();
      var nouveau = $('#mdp-nouveau').value;

      if (nouveau !== $('#mdp-confirmation').value) {
        retour.textContent = 'Les deux nouveaux mots de passe ne correspondent pas.';
        retour.hidden = false;
        return;
      }

      appeler('/api/motdepasse', {
        methode: 'POST',
        corps: { ancien: $('#mdp-ancien').value, nouveau: nouveau },
      }).then(function (r) {
        if (!r.ok) {
          retour.textContent = r.donnees.erreur || 'Changement impossible.';
          retour.hidden = false;
          return;
        }
        dialogue.close();
        messageEtat('Mot de passe modifié.', 'enregistre');
      }).catch(function (e) {
        retour.textContent = e.message;
        retour.hidden = false;
      });
    });
  }

  function demarrer() {
    appeler('/api/session').then(function (r) {
      if (!r.donnees.connecte) {
        window.location.href = '/admin';
        return;
      }
      $('#utilisateur').textContent = r.donnees.identifiant;
      charger();
    });

    brancherOnglets();
    brancherAjouts();
    brancherMotDePasse();

    $('#note-carte').addEventListener('input', function (e) {
      contenu.noteCarte = e.target.value;
      marquerModifie();
    });

    $('#bouton-enregistrer').addEventListener('click', enregistrer);

    $('#bouton-annuler').addEventListener('click', function () {
      if (JSON.stringify(contenu) === reference) return;
      if (!confirm('Abandonner les modifications non enregistrées ?')) return;
      contenu = JSON.parse(reference);
      toutRendre();
    });

    $('#bouton-deconnexion').addEventListener('click', function () {
      appeler('/api/deconnexion', { methode: 'POST' }).finally(function () {
        reference = JSON.stringify(contenu); // évite l'alerte de sortie
        window.location.href = '/admin';
      });
    });
  }

  demarrer();
})();

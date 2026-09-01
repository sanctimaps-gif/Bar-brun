/* =============================================================
   Bar Brun — logique de la page
   Le contenu vient de data/contenu.js, les horaires de horaires.js.
   ============================================================= */

(function () {
  'use strict';

  var C = window.CONTENU;
  var Horaires = window.Horaires;

  if (!C || !Horaires) {
    console.error('Bar Brun : data/contenu.js ou assets/js/horaires.js n\'a pas été chargé.');
    return;
  }

  var H = Horaires.creer(C);
  var JOURS = Horaires.JOURS;
  var MOIS = Horaires.MOIS;
  var enMinutes = Horaires.enMinutes;
  var formatHeure = Horaires.formatHeure;
  var dateLocale = Horaires.dateLocale;
  var isoDuJour = Horaires.isoDuJour;

  var $ = function (sel, racine) { return (racine || document).querySelector(sel); };
  var $$ = function (sel, racine) {
    return Array.prototype.slice.call((racine || document).querySelectorAll(sel));
  };

  /* ---------------------------------------------------------------
   * Petits utilitaires
   * ------------------------------------------------------------- */

  function formatPrix(valeur) {
    if (typeof valeur !== 'number') return String(valeur);
    return valeur.toFixed(2).replace('.', ',').replace(/,00$/, '') + ' €';
  }

  function sansAccents(texte) {
    return String(texte).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function vider(element) {
    while (element.firstChild) element.removeChild(element.firstChild);
  }

  function creer(balise, options) {
    var el = document.createElement(balise);
    options = options || {};
    if (options.classe) el.className = options.classe;
    if (options.texte != null) el.textContent = options.texte;
    if (options.attrs) {
      Object.keys(options.attrs).forEach(function (cle) {
        if (options.attrs[cle] != null) el.setAttribute(cle, options.attrs[cle]);
      });
    }
    return el;
  }

  /* ---------------------------------------------------------------
   * Identité et liens
   * ------------------------------------------------------------- */

  function adressePlate() {
    var a = C.bar.adresse;
    return a.rue + ', ' + a.codePostal + ' ' + a.ville + ', ' + a.pays;
  }

  function lienItineraire() {
    return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(adressePlate());
  }

  function remplirIdentite() {
    var a = C.bar.adresse;
    var valeurs = {
      nom: C.bar.nom,
      accroche: C.bar.accroche,
      description: C.bar.description,
      mentions: C.bar.mentions,
      'adresse-ligne1': a.rue,
      'adresse-ligne2': a.codePostal + ' ' + a.ville,
      pays: a.pays,
    };

    $$('[data-champ]').forEach(function (el) {
      var cle = el.getAttribute('data-champ');
      if (valeurs[cle] != null) el.textContent = valeurs[cle];
    });

    document.title = C.bar.nom + ' — ' + a.rue + ', ' + a.ville;

    var noteCarte = $('#note-carte');
    if (noteCarte) {
      noteCarte.hidden = !C.noteCarte;
      noteCarte.textContent = C.noteCarte || '';
    }
  }

  function listeDeLiens(conteneur, liens) {
    if (!conteneur) return;
    vider(conteneur);
    liens.forEach(function (l) {
      var li = creer('li');
      li.appendChild(creer('a', {
        texte: l.texte,
        attrs: { href: l.url, target: l.externe ? '_blank' : null, rel: l.externe ? 'noopener' : null },
      }));
      conteneur.appendChild(li);
    });
  }

  function liensContact() {
    var liens = [];
    if (C.bar.contact.telephone) {
      liens.push({
        texte: C.bar.contact.telephone,
        url: 'tel:' + C.bar.contact.telephone.replace(/[^\d+]/g, ''),
      });
    }
    if (C.bar.contact.email) {
      liens.push({ texte: C.bar.contact.email, url: 'mailto:' + C.bar.contact.email });
    }
    return liens;
  }

  function remplirLiens() {
    var a = C.bar.adresse;
    var q = encodeURIComponent(adressePlate());

    var itineraire = $('#lien-itineraire');
    if (itineraire) {
      itineraire.href = lienItineraire();
    }

    listeDeLiens($('#liens-carte'), [
      { texte: 'Itinéraire (Google Maps)', url: lienItineraire(), externe: true },
      { texte: 'Ouvrir dans Plans (Apple)', url: 'https://maps.apple.com/?q=' + q, externe: true },
      {
        texte: 'Voir sur OpenStreetMap',
        url: 'https://www.openstreetmap.org/?mlat=' + a.latitude + '&mlon=' + a.longitude +
             '#map=18/' + a.latitude + '/' + a.longitude,
        externe: true,
      },
    ]);

    var contacts = liensContact();
    var listeContact = $('#liens-contact');
    if (contacts.length) {
      listeDeLiens(listeContact, contacts);
    } else if (listeContact) {
      vider(listeContact);
      listeContact.appendChild(creer('li', { classe: 'infos__note', texte: 'Coordonnées à venir.' }));
    }

    listeDeLiens($('#liens-reseaux'), (C.bar.reseaux || []).map(function (r) {
      return { texte: r.nom, url: r.url, externe: true };
    }));

    listeDeLiens($('#pied-liens'), contacts
      .concat((C.bar.reseaux || []).map(function (r) { return { texte: r.nom, url: r.url, externe: true }; }))
      .concat([{ texte: 'Itinéraire', url: lienItineraire(), externe: true }]));
  }

  /* ---------------------------------------------------------------
   * Statut d'ouverture et tableau des horaires
   * ------------------------------------------------------------- */

  function majStatut() {
    var maintenant = new Date();
    var s = H.texteStatut(maintenant);

    var bloc = $('#statut');
    if (bloc) {
      bloc.setAttribute('data-etat', s.etat);
      $('.statut__texte', bloc).textContent = s.texte;
    }

    var banniere = $('#banniere-hh');
    if (banniere) {
      if (H.happyHourEnCours(maintenant)) {
        banniere.hidden = false;
        banniere.textContent = 'Happy hour jusqu\'à ' + formatHeure(enMinutes(C.happyHour.fin)) +
          ' · ' + C.happyHour.texte;
      } else {
        banniere.hidden = true;
      }
    }
  }

  function rendreHoraires() {
    var corps = $('#horaires-corps');
    if (!corps) return;
    vider(corps);

    var aujourdhui = JOURS[new Date().getDay()];

    H.semaine().forEach(function (ligne) {
      var tr = creer('tr', {
        attrs: {
          'data-aujourdhui': ligne.jour === aujourdhui ? 'true' : 'false',
          'data-ferme': ligne.ferme ? 'true' : 'false',
        },
      });
      tr.appendChild(creer('td', { texte: ligne.libelle }));
      tr.appendChild(creer('td', { texte: ligne.texte }));
      corps.appendChild(tr);
    });

    var note = $('#fermetures');
    if (note) {
      var aVenir = H.fermeturesAVenir(new Date());
      note.hidden = aVenir.length === 0;
      if (aVenir.length) {
        note.textContent = 'Fermetures exceptionnelles : ' + aVenir.map(function (f) {
          var du = dateLocale(f.du || f.date);
          var au = dateLocale(f.au || f.date || f.du);
          if (!du) return f.motif || '';
          var libelle = du.getDate() + ' ' + MOIS[du.getMonth()];
          if (au && au.getTime() !== du.getTime()) {
            libelle += ' au ' + au.getDate() + ' ' + MOIS[au.getMonth()];
          }
          return libelle + (f.motif ? ' (' + f.motif + ')' : '');
        }).join(' ; ') + '.';
      }
    }

    var noteHH = $('#note-hh');
    if (noteHH && C.happyHour && C.happyHour.actif) {
      noteHH.hidden = false;
      noteHH.textContent = 'Happy hour ' + listerJours(C.happyHour.jours) + ' de ' +
        formatHeure(enMinutes(C.happyHour.debut)) + ' à ' + formatHeure(enMinutes(C.happyHour.fin)) +
        ' : ' + C.happyHour.texte + '.';
    }
  }

  function listerJours(jours) {
    if (!jours || !jours.length) return '';
    if (jours.length === 1) return 'le ' + jours[0];
    if (jours.length === 2) return 'les ' + jours[0] + ' et ' + jours[1];
    return 'du ' + jours[0] + ' au ' + jours[jours.length - 1];
  }

  /* ---------------------------------------------------------------
   * La carte
   * ------------------------------------------------------------- */

  var LIBELLES_ETIQUETTES = {
    local: 'Local',
    'sans-alcool': 'Sans alcool',
    vegan: 'Végétal',
    nouveau: 'Nouveau',
  };

  var filtreCategorie = 'toutes';
  var filtresEtiquettes = [];
  var recherche = '';

  function etiquettesDisponibles() {
    var vues = [];
    (C.carte || []).forEach(function (groupe) {
      (groupe.articles || []).forEach(function (article) {
        (article.etiquettes || []).forEach(function (e) {
          if (vues.indexOf(e) === -1) vues.push(e);
        });
      });
    });
    return vues;
  }

  function construireFiltres() {
    var zoneCat = $('#filtres-categories');
    if (zoneCat) {
      vider(zoneCat);
      [{ id: 'toutes', titre: 'Tout' }]
        .concat((C.carte || []).map(function (g) { return { id: g.id, titre: g.titre }; }))
        .forEach(function (cat) {
          var bouton = creer('button', {
            classe: 'puce',
            texte: cat.titre,
            attrs: {
              type: 'button',
              'aria-pressed': cat.id === filtreCategorie ? 'true' : 'false',
              'data-cat': cat.id,
            },
          });
          bouton.addEventListener('click', function () {
            filtreCategorie = cat.id;
            $$('[data-cat]', zoneCat).forEach(function (b) {
              b.setAttribute('aria-pressed', b.getAttribute('data-cat') === filtreCategorie ? 'true' : 'false');
            });
            rendreCarte();
          });
          zoneCat.appendChild(bouton);
        });
    }

    var zoneEtq = $('#filtres-etiquettes');
    if (zoneEtq) {
      vider(zoneEtq);
      etiquettesDisponibles().forEach(function (etq) {
        var bouton = creer('button', {
          classe: 'puce puce--etiquette',
          texte: LIBELLES_ETIQUETTES[etq] || etq,
          attrs: { type: 'button', 'aria-pressed': 'false', 'data-etq': etq },
        });
        bouton.addEventListener('click', function () {
          var i = filtresEtiquettes.indexOf(etq);
          if (i === -1) filtresEtiquettes.push(etq);
          else filtresEtiquettes.splice(i, 1);
          bouton.setAttribute('aria-pressed', i === -1 ? 'true' : 'false');
          rendreCarte();
        });
        zoneEtq.appendChild(bouton);
      });
    }
  }

  function articleCorrespond(article) {
    if (filtresEtiquettes.length) {
      var etqs = article.etiquettes || [];
      var toutes = filtresEtiquettes.every(function (e) { return etqs.indexOf(e) !== -1; });
      if (!toutes) return false;
    }

    if (recherche) {
      var foin = sansAccents(
        article.nom + ' ' + (article.description || '') + ' ' + (article.etiquettes || []).join(' ')
      );
      if (foin.indexOf(recherche) === -1) return false;
    }

    return true;
  }

  function rendreArticle(article) {
    var li = creer('li', { classe: 'article' });

    var nom = creer('p', { classe: 'article__nom' });
    nom.appendChild(document.createTextNode(article.nom));

    if ((article.etiquettes || []).length) {
      var zone = creer('span', { classe: 'etiquettes' });
      article.etiquettes.forEach(function (e) {
        zone.appendChild(creer('span', {
          classe: 'etiquette etiquette--' + e,
          texte: LIBELLES_ETIQUETTES[e] || e,
        }));
      });
      nom.appendChild(zone);
    }
    li.appendChild(nom);

    if (article.description) {
      li.appendChild(creer('p', { classe: 'article__description', texte: article.description }));
    }

    var prix = creer('p', { classe: 'article__prix' });
    Object.keys(article.prix || {}).forEach(function (format) {
      var ligne = creer('span');
      ligne.appendChild(document.createTextNode(formatPrix(article.prix[format]) + ' '));
      ligne.appendChild(creer('small', { texte: format }));
      prix.appendChild(ligne);
    });
    li.appendChild(prix);

    return li;
  }

  function rendreCarte() {
    var conteneur = $('#carte-liste');
    if (!conteneur) return;
    vider(conteneur);

    var total = 0;

    (C.carte || []).forEach(function (groupe) {
      if (filtreCategorie !== 'toutes' && groupe.id !== filtreCategorie) return;

      var articles = (groupe.articles || []).filter(articleCorrespond);
      if (!articles.length) return;
      total += articles.length;

      var section = creer('section', { classe: 'groupe' });

      var entete = creer('div', { classe: 'groupe__titre' });
      entete.appendChild(creer('h3', { texte: groupe.titre }));
      if (groupe.note) entete.appendChild(creer('p', { classe: 'groupe__note', texte: groupe.note }));
      section.appendChild(entete);

      var liste = creer('ul', { classe: 'articles' });
      articles.forEach(function (article) { liste.appendChild(rendreArticle(article)); });
      section.appendChild(liste);

      conteneur.appendChild(section);
    });

    var resultat = $('#carte-resultat');
    if (!resultat) return;

    var filtree = recherche || filtresEtiquettes.length || filtreCategorie !== 'toutes';
    if (!total) {
      resultat.textContent = 'Aucune boisson ne correspond — essayez « bière », « sans alcool », ou remettez les filtres à zéro.';
    } else if (filtree) {
      resultat.textContent = total + (total > 1 ? ' références affichées' : ' référence affichée');
    } else {
      resultat.textContent = '';
    }
  }

  function brancherRecherche() {
    var champ = $('#recherche-carte');
    if (!champ) return;
    champ.addEventListener('input', function () {
      recherche = sansAccents(champ.value.trim());
      rendreCarte();
    });
  }

  /* ---------------------------------------------------------------
   * Agenda
   * ------------------------------------------------------------- */

  function evenementsAVenir(maintenant) {
    return (C.agenda || [])
      .map(function (e) {
        var debut = dateLocale(e.date, e.debut);
        if (!debut) return null;
        var fin = dateLocale(e.date, e.fin || e.debut) || debut;
        // Une soirée qui se termine après minuit déborde sur le lendemain.
        if (fin < debut) fin = new Date(fin.getTime() + 24 * 3600 * 1000);
        return { source: e, debut: debut, fin: fin };
      })
      .filter(function (e) { return e && e.fin >= maintenant; })
      .sort(function (a, b) { return a.debut - b.debut; });
  }

  function rendreEvenement(e, maintenant) {
    var joursRestants = Math.ceil((e.debut - maintenant) / (24 * 3600 * 1000));
    var li = creer('li', { classe: 'evenement' + (joursRestants <= 7 ? ' evenement--bientot' : '') });

    var bloc = creer('div', { classe: 'evenement__date' });
    bloc.appendChild(creer('span', { classe: 'evenement__jour', texte: String(e.debut.getDate()) }));
    bloc.appendChild(creer('span', { classe: 'evenement__mois', texte: MOIS[e.debut.getMonth()] }));
    bloc.appendChild(creer('span', { classe: 'evenement__semaine', texte: JOURS[e.debut.getDay()] }));
    li.appendChild(bloc);

    var corps = creer('div');
    corps.appendChild(creer('h3', { classe: 'evenement__titre', texte: e.source.titre }));

    var meta = [];
    if (e.source.debut) {
      meta.push(formatHeure(enMinutes(e.source.debut)) +
        (e.source.fin ? ' – ' + formatHeure(enMinutes(e.source.fin)) : ''));
    }
    if (e.source.prix) meta.push(e.source.prix);
    if (joursRestants <= 0) meta.push('c\'est ce soir');
    else if (joursRestants === 1) meta.push('demain');
    else if (joursRestants <= 7) meta.push('dans ' + joursRestants + ' jours');
    corps.appendChild(creer('p', { classe: 'evenement__meta', texte: meta.join(' · ') }));

    if (e.source.description) {
      corps.appendChild(creer('p', { classe: 'evenement__description', texte: e.source.description }));
    }
    li.appendChild(corps);

    var action = creer('div', { classe: 'evenement__action' });
    var bouton = creer('button', {
      classe: 'bouton',
      texte: 'Ajouter au calendrier',
      attrs: { type: 'button' },
    });
    bouton.addEventListener('click', function () { telechargerIcs(e); });
    action.appendChild(bouton);
    li.appendChild(action);

    return li;
  }

  function rendreAgenda() {
    var liste = $('#agenda-liste');
    var vide = $('#agenda-vide');
    if (!liste) return;
    vider(liste);

    var maintenant = new Date();
    var evenements = evenementsAVenir(maintenant);

    if (vide) vide.hidden = evenements.length > 0;

    evenements.forEach(function (e) {
      liste.appendChild(rendreEvenement(e, maintenant));
    });
  }

  /** Fabrique un fichier .ics côté navigateur, sans serveur. */
  function telechargerIcs(e) {
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    var local = function (d) {
      return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + 'T' +
        pad(d.getHours()) + pad(d.getMinutes()) + '00';
    };
    var utc = function (d) {
      return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' +
        pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z';
    };
    var echapper = function (t) {
      return String(t == null ? '' : t).replace(/([\\,;])/g, '\\$1').replace(/\n/g, '\\n');
    };

    var description = e.source.description || '';
    if (e.source.prix) description += (description ? ' ' : '') + '(' + e.source.prix + ')';

    var lignes = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'CALSCALE:GREGORIAN',
      'PRODID:-//Bar Brun//Agenda//FR',
      'BEGIN:VEVENT',
      'UID:' + local(e.debut) + '-' + Math.random().toString(36).slice(2, 8) + '@bar-brun',
      'DTSTAMP:' + utc(new Date()),
      'DTSTART:' + local(e.debut),
      'DTEND:' + local(e.fin),
      'SUMMARY:' + echapper(e.source.titre + ' — ' + C.bar.nom),
      'DESCRIPTION:' + echapper(description),
      'LOCATION:' + echapper(C.bar.nom + ', ' + adressePlate()),
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ];

    var blob = new Blob([lignes.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var lien = creer('a', {
      attrs: {
        href: url,
        download: sansAccents(e.source.titre).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.ics',
      },
    });
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function rendreRituels() {
    var liste = $('#rituels-liste');
    var bloc = $('#rituels');
    if (!liste) return;
    vider(liste);

    if (!(C.rituels || []).length) {
      if (bloc) bloc.hidden = true;
      return;
    }

    C.rituels.forEach(function (r) {
      var li = creer('li');
      li.appendChild(creer('strong', { texte: r.quand }));
      li.appendChild(creer('span', { texte: r.quoi }));
      liste.appendChild(li);
    });
  }

  /* ---------------------------------------------------------------
   * Réservation
   * ------------------------------------------------------------- */

  /**
   * Sans adresse e-mail configurée, un formulaire qui prépare un courriel
   * n'a nulle part où l'envoyer : on renvoie alors vers le téléphone.
   */
  function remplacerFormulaireParTelephone(form) {
    var bloc = creer('div', { classe: 'appel' });
    bloc.appendChild(creer('p', {
      classe: 'appel__texte',
      texte: 'Les réservations se prennent par téléphone, au comptoir ou par message sur les réseaux du bar.',
    }));

    if (C.bar.contact.telephone) {
      var lien = creer('a', {
        classe: 'bouton bouton--plein',
        texte: 'Appeler le ' + C.bar.contact.telephone,
        attrs: { href: 'tel:' + C.bar.contact.telephone.replace(/[^\d+]/g, '') },
      });
      bloc.appendChild(lien);
    }

    (C.bar.reseaux || []).forEach(function (r) {
      bloc.appendChild(creer('a', {
        classe: 'bouton',
        texte: 'Écrire sur ' + r.nom,
        attrs: { href: r.url, target: '_blank', rel: 'noopener' },
      }));
    });

    form.parentNode.replaceChild(bloc, form);

    var intro = $('#reserver .section__intro');
    if (intro) {
      intro.textContent = 'Pour les groupes et les soirs de match, mieux vaut prévenir : ' +
        'un appel suffit.';
    }
  }

  function brancherFormulaire() {
    var form = $('#formulaire-reservation');
    if (!form) return;

    if (!C.bar.contact.email) {
      remplacerFormulaireParTelephone(form);
      return;
    }

    var retour = $('#retour-reservation');
    var champDate = $('#res-date');
    if (champDate) {
      champDate.min = isoDuJour(new Date());
      champDate.value = champDate.min;
    }

    form.addEventListener('submit', function (evt) {
      evt.preventDefault();

      var minuit = new Date();
      minuit.setHours(0, 0, 0, 0);

      var regles = [
        { id: 'res-nom', err: 'err-nom', message: 'Merci d\'indiquer un nom.',
          valide: function (v) { return v.trim() !== ''; } },
        { id: 'res-contact', err: 'err-contact', message: 'Un téléphone ou un e-mail, pour vous confirmer la table.',
          valide: function (v) { return v.trim().length >= 5; } },
        { id: 'res-date', err: 'err-date', message: 'Choisissez une date à venir.',
          valide: function (v) { var d = dateLocale(v); return !!d && d >= minuit; } },
        { id: 'res-heure', err: 'err-heure', message: 'Choisissez une heure.',
          valide: function (v) { return enMinutes(v) != null; } },
        { id: 'res-personnes', err: 'err-personnes', message: 'Indiquez un nombre entre 1 et 40.',
          valide: function (v) { var n = parseInt(v, 10); return !isNaN(n) && n >= 1 && n <= 40; } },
      ];

      var premierEnErreur = null;

      regles.forEach(function (regle) {
        var input = document.getElementById(regle.id);
        var erreur = document.getElementById(regle.err);
        var ok = regle.valide(input.value);

        input.setAttribute('aria-invalid', ok ? 'false' : 'true');
        erreur.hidden = ok;
        erreur.textContent = ok ? '' : regle.message;
        if (!ok && !premierEnErreur) premierEnErreur = input;
      });

      if (premierEnErreur) {
        premierEnErreur.focus();
        retour.textContent = 'Quelques champs sont à compléter.';
        return;
      }

      var destinataire = C.bar.contact.email;
      if (!destinataire) {
        retour.textContent = 'Aucune adresse e-mail n\'est configurée : appelez le bar pour réserver.';
        return;
      }

      var date = dateLocale($('#res-date').value);
      var dateLisible = JOURS[date.getDay()] + ' ' + date.getDate() + ' ' +
        MOIS[date.getMonth()] + ' ' + date.getFullYear();
      var personnes = $('#res-personnes').value;

      var corps = [
        'Bonjour,',
        '',
        'Je souhaite réserver une table :',
        '· Nom : ' + $('#res-nom').value.trim(),
        '· Date : ' + dateLisible,
        '· Heure : ' + $('#res-heure').value,
        '· Personnes : ' + personnes,
        '· Contact : ' + $('#res-contact').value.trim(),
      ];

      var message = $('#res-message').value.trim();
      if (message) corps.push('· Précisions : ' + message);
      corps.push('', 'Merci d\'avance.');

      var lien = 'mailto:' + encodeURIComponent(destinataire) +
        '?subject=' + encodeURIComponent('Réservation — ' + dateLisible + ' — ' + personnes + ' pers.') +
        '&body=' + encodeURIComponent(corps.join('\n'));

      window.location.href = lien;
      retour.textContent = 'Votre messagerie s\'ouvre avec le message pré-rempli : il ne reste qu\'à l\'envoyer.';
    });
  }

  /* ---------------------------------------------------------------
   * Navigation mobile
   * ------------------------------------------------------------- */

  function brancherNavigation() {
    var bascule = $('.nav__bascule');
    var liens = $('#nav-liens');
    if (!bascule || !liens) return;

    var basculer = function (ouvrir) {
      liens.setAttribute('data-ouvert', ouvrir ? 'true' : 'false');
      bascule.setAttribute('aria-expanded', ouvrir ? 'true' : 'false');
      $('.visuellement-cache', bascule).textContent = ouvrir ? 'Fermer le menu' : 'Ouvrir le menu';
    };

    bascule.addEventListener('click', function () {
      basculer(bascule.getAttribute('aria-expanded') !== 'true');
    });

    liens.addEventListener('click', function (evt) {
      if (evt.target.tagName === 'A') basculer(false);
    });

    document.addEventListener('keydown', function (evt) {
      if (evt.key === 'Escape') basculer(false);
    });
  }

  /* ---------------------------------------------------------------
   * Démarrage
   * ------------------------------------------------------------- */

  remplirIdentite();
  remplirLiens();
  rendreHoraires();
  majStatut();
  construireFiltres();
  brancherRecherche();
  rendreCarte();
  rendreAgenda();
  rendreRituels();
  brancherFormulaire();
  brancherNavigation();

  // Le statut se remet à jour tout seul : utile sur un écran laissé allumé au bar.
  setInterval(majStatut, 60000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) majStatut();
  });

  // Cache hors ligne (le réseau est capricieux dans les salles voûtées).
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* sans conséquence */ });
    });
  }
})();

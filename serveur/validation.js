/* =============================================================
   Validation du contenu enregistré depuis l'espace d'administration.
   Rien n'est écrit sur le disque tant que cette vérification échoue.
   ============================================================= */

'use strict';

var path = require('path');
var Horaires = require(path.join(__dirname, '..', 'assets', 'js', 'horaires.js'));

var ETIQUETTES = ['local', 'sans-alcool', 'vegan', 'nouveau'];

function estTexte(v) {
  return typeof v === 'string';
}

function estObjet(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Vérifie la structure d'un contenu complet.
 * @returns {string[]} la liste des erreurs (vide si tout va bien).
 */
function verifierContenu(contenu) {
  var erreurs = [];

  function exiger(condition, message) {
    if (!condition) erreurs.push(message);
  }

  if (!estObjet(contenu)) return ['Le contenu envoyé n\'est pas un objet.'];

  /* ---- Identité ---- */
  var bar = contenu.bar;
  if (!estObjet(bar)) {
    erreurs.push('La section « bar » est absente.');
  } else {
    exiger(estTexte(bar.nom) && bar.nom.trim() !== '', 'Le nom du bar est obligatoire.');
    ['accroche', 'description', 'mentions'].forEach(function (cle) {
      exiger(bar[cle] === undefined || estTexte(bar[cle]), 'Le champ « ' + cle + ' » doit être du texte.');
    });

    var a = bar.adresse;
    if (!estObjet(a)) {
      erreurs.push('L\'adresse est absente.');
    } else {
      exiger(estTexte(a.rue) && a.rue.trim() !== '', 'La rue est obligatoire.');
      exiger(/^\d{5}$/.test(String(a.codePostal || '')), 'Le code postal doit comporter 5 chiffres.');
      exiger(estTexte(a.ville) && a.ville.trim() !== '', 'La ville est obligatoire.');
      exiger(typeof a.latitude === 'number' && a.latitude >= -90 && a.latitude <= 90,
        'La latitude doit être un nombre entre -90 et 90.');
      exiger(typeof a.longitude === 'number' && a.longitude >= -180 && a.longitude <= 180,
        'La longitude doit être un nombre entre -180 et 180.');
    }

    var contact = bar.contact;
    if (!estObjet(contact)) {
      erreurs.push('Les coordonnées de contact sont absentes.');
    } else {
      exiger(estTexte(contact.telephone), 'Le téléphone doit être du texte (vide si non communiqué).');
      exiger(estTexte(contact.email), 'L\'e-mail doit être du texte (vide si non communiqué).');
      exiger(contact.email === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email),
        'L\'adresse e-mail « ' + contact.email + ' » n\'est pas valide.');
    }

    if (bar.reseaux !== undefined) {
      exiger(Array.isArray(bar.reseaux), 'Les réseaux sociaux doivent former une liste.');
      (bar.reseaux || []).forEach(function (r, i) {
        exiger(estObjet(r) && estTexte(r.nom) && r.nom.trim() !== '',
          'Réseau #' + (i + 1) + ' : le nom est obligatoire.');
        exiger(estObjet(r) && /^https?:\/\/.+/.test(String(r.url || '')),
          'Réseau #' + (i + 1) + ' : l\'adresse doit commencer par http:// ou https://.');
      });
    }
  }

  /* ---- Horaires ---- */
  var horaires = contenu.horaires;
  if (!estObjet(horaires)) {
    erreurs.push('La section « horaires » est absente.');
  } else {
    Horaires.JOURS_AFFICHES.forEach(function (jour) {
      var plages = horaires[jour];
      if (!Array.isArray(plages)) {
        erreurs.push('Les horaires du ' + jour + ' doivent former une liste (vide si le bar est fermé).');
        return;
      }
      plages.forEach(function (p, i) {
        var ou = jour + ', plage ' + (i + 1);
        var debut = estObjet(p) ? Horaires.enMinutes(p.ouverture) : null;
        var fin = estObjet(p) ? Horaires.enMinutes(p.fermeture) : null;
        exiger(debut !== null, ou + ' : heure d\'ouverture invalide.');
        exiger(fin !== null, ou + ' : heure de fermeture invalide.');
        exiger(debut === null || fin === null || debut !== fin,
          ou + ' : l\'ouverture et la fermeture ne peuvent pas être identiques.');
      });
    });
  }

  /* ---- Fermetures exceptionnelles ---- */
  if (contenu.fermetures !== undefined) {
    if (!Array.isArray(contenu.fermetures)) {
      erreurs.push('Les fermetures exceptionnelles doivent former une liste.');
    } else {
      contenu.fermetures.forEach(function (f, i) {
        var ou = 'Fermeture #' + (i + 1);
        var du = estObjet(f) ? Horaires.dateLocale(f.du) : null;
        var au = estObjet(f) ? Horaires.dateLocale(f.au || f.du) : null;
        exiger(du !== null, ou + ' : date de début invalide (format attendu : 2026-12-24).');
        exiger(au !== null, ou + ' : date de fin invalide.');
        exiger(du === null || au === null || au >= du, ou + ' : la fin précède le début.');
      });
    }
  }

  /* ---- Happy hour ---- */
  if (contenu.happyHour !== undefined && contenu.happyHour !== null) {
    var hh = contenu.happyHour;
    if (!estObjet(hh)) {
      erreurs.push('L\'happy hour doit être un objet.');
    } else {
      exiger(typeof hh.actif === 'boolean', 'L\'happy hour doit être activé ou désactivé (vrai/faux).');
      if (hh.actif) {
        var d = Horaires.enMinutes(hh.debut);
        var f = Horaires.enMinutes(hh.fin);
        exiger(d !== null, 'Happy hour : heure de début invalide.');
        exiger(f !== null, 'Happy hour : heure de fin invalide.');
        exiger(d === null || f === null || f > d, 'Happy hour : la fin doit suivre le début.');
        exiger(Array.isArray(hh.jours) && hh.jours.length > 0, 'Happy hour : choisissez au moins un jour.');
        (hh.jours || []).forEach(function (j) {
          exiger(Horaires.JOURS.indexOf(j) !== -1, 'Happy hour : « ' + j + ' » n\'est pas un jour valide.');
        });
        exiger(estTexte(hh.texte), 'Happy hour : le texte affiché doit être renseigné.');
      }
    }
  }

  /* ---- La carte ---- */
  if (!Array.isArray(contenu.carte)) {
    erreurs.push('La carte doit former une liste de catégories.');
  } else {
    var ids = [];
    contenu.carte.forEach(function (groupe, i) {
      var ou = 'Catégorie #' + (i + 1);
      if (!estObjet(groupe)) {
        erreurs.push(ou + ' : format invalide.');
        return;
      }
      ou = 'Catégorie « ' + (groupe.titre || groupe.id || i + 1) + ' »';

      exiger(/^[a-z0-9-]+$/.test(String(groupe.id || '')),
        ou + ' : l\'identifiant ne peut contenir que des lettres minuscules, des chiffres et des tirets.');
      exiger(ids.indexOf(groupe.id) === -1, ou + ' : cet identifiant est déjà utilisé.');
      ids.push(groupe.id);
      exiger(estTexte(groupe.titre) && groupe.titre.trim() !== '', ou + ' : le titre est obligatoire.');
      exiger(groupe.note === undefined || estTexte(groupe.note), ou + ' : la note doit être du texte.');

      if (!Array.isArray(groupe.articles)) {
        erreurs.push(ou + ' : la liste des articles est absente.');
        return;
      }

      groupe.articles.forEach(function (article, j) {
        var oua = ou + ', article #' + (j + 1);
        if (!estObjet(article)) {
          erreurs.push(oua + ' : format invalide.');
          return;
        }
        oua = ou + ' → « ' + (article.nom || ('article #' + (j + 1))) + ' »';

        exiger(estTexte(article.nom) && article.nom.trim() !== '', oua + ' : le nom est obligatoire.');
        exiger(article.description === undefined || estTexte(article.description),
          oua + ' : la description doit être du texte.');

        if (!estObjet(article.prix)) {
          erreurs.push(oua + ' : indiquez au moins un prix.');
        } else {
          var formats = Object.keys(article.prix);
          exiger(formats.length > 0, oua + ' : indiquez au moins un prix.');
          formats.forEach(function (format) {
            exiger(format.trim() !== '', oua + ' : un format de vente est vide (25 cl, verre, bouteille…).');
            var prix = article.prix[format];
            exiger(typeof prix === 'number' && isFinite(prix) && prix > 0,
              oua + ' : le prix « ' + format + ' » doit être un nombre supérieur à zéro.');
            exiger(typeof prix !== 'number' || Math.round(prix * 100) === prix * 100,
              oua + ' : le prix « ' + format + ' » ne peut pas avoir plus de deux décimales.');
          });
        }

        (article.etiquettes || []).forEach(function (e) {
          exiger(ETIQUETTES.indexOf(e) !== -1, oua + ' : étiquette inconnue « ' + e + ' ».');
        });
      });
    });
  }

  /* ---- Agenda ---- */
  if (!Array.isArray(contenu.agenda)) {
    erreurs.push('L\'agenda doit former une liste.');
  } else {
    contenu.agenda.forEach(function (e, i) {
      var ou = 'Événement #' + (i + 1);
      if (!estObjet(e)) {
        erreurs.push(ou + ' : format invalide.');
        return;
      }
      ou = 'Événement « ' + (e.titre || ('#' + (i + 1))) + ' »';

      exiger(estTexte(e.titre) && e.titre.trim() !== '', ou + ' : le titre est obligatoire.');
      exiger(Horaires.dateLocale(e.date) !== null, ou + ' : date invalide (format attendu : 2026-09-10).');
      exiger(Horaires.enMinutes(e.debut) !== null, ou + ' : heure de début invalide.');
      exiger(e.fin === undefined || e.fin === '' || Horaires.enMinutes(e.fin) !== null,
        ou + ' : heure de fin invalide.');
      exiger(e.prix === undefined || estTexte(e.prix), ou + ' : le tarif doit être du texte (« Entrée libre », « 15 € »…).');
      exiger(e.description === undefined || estTexte(e.description), ou + ' : la description doit être du texte.');
    });
  }

  /* ---- Rendez-vous réguliers ---- */
  if (contenu.rituels !== undefined) {
    if (!Array.isArray(contenu.rituels)) {
      erreurs.push('Les rendez-vous réguliers doivent former une liste.');
    } else {
      contenu.rituels.forEach(function (r, i) {
        exiger(estObjet(r) && estTexte(r.quand) && r.quand.trim() !== '',
          'Rendez-vous #' + (i + 1) + ' : indiquez le jour.');
        exiger(estObjet(r) && estTexte(r.quoi) && r.quoi.trim() !== '',
          'Rendez-vous #' + (i + 1) + ' : indiquez ce qui s\'y passe.');
      });
    }
  }

  if (contenu.noteCarte !== undefined) {
    exiger(estTexte(contenu.noteCarte), 'La note de la carte doit être du texte.');
  }

  return erreurs;
}

module.exports = { verifierContenu: verifierContenu, ETIQUETTES: ETIQUETTES };

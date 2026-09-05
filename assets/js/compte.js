/* =============================================================
   Tiroir « Compte » du site public.

   Une languette discrète sur le bord droit ouvre un panneau :
   - la toute première fois, on y choisit le mot de passe ;
   - ensuite, on le saisit pour ouvrir l'espace de modification
     (horaires, carte, événements).

   Sans serveur (site déposé sur un hébergement statique), le
   panneau l'explique au lieu d'afficher un formulaire inutile.
   ============================================================= */

(function () {
  'use strict';

  var tiroir = document.getElementById('tiroir');
  var languette = document.getElementById('tiroir-languette');
  var panneau = document.getElementById('tiroir-panneau');
  var corps = document.getElementById('tiroir-corps');
  var fermer = document.getElementById('tiroir-fermer');

  if (!tiroir || !languette || !panneau || !corps) return;

  var etatCharge = false;

  /* ---------------------------------------------------------------
   * Petits outils
   * ------------------------------------------------------------- */

  function el(balise, options, enfants) {
    var noeud = document.createElement(balise);
    options = options || {};
    if (options.classe) noeud.className = options.classe;
    if (options.texte != null) noeud.textContent = options.texte;
    Object.keys(options.attrs || {}).forEach(function (cle) {
      if (options.attrs[cle] != null) noeud.setAttribute(cle, options.attrs[cle]);
    });
    (enfants || []).forEach(function (enfant) { if (enfant) noeud.appendChild(enfant); });
    return noeud;
  }

  function vider(noeud) {
    while (noeud.firstChild) noeud.removeChild(noeud.firstChild);
  }

  function appeler(chemin, options) {
    options = options || {};
    return fetch(chemin, {
      method: options.methode || 'GET',
      headers: { 'Content-Type': 'application/json', 'X-Cafe-Brun': '1' },
      body: options.corps ? JSON.stringify(options.corps) : undefined,
      cache: 'no-store',
    }).then(function (reponse) {
      return reponse.json()
        .catch(function () { return {}; })
        .then(function (donnees) {
          return { ok: reponse.ok, statut: reponse.status, donnees: donnees };
        });
    });
  }

  /* ---------------------------------------------------------------
   * Ouverture et fermeture
   * ------------------------------------------------------------- */

  function ouvrir() {
    panneau.hidden = false;
    tiroir.setAttribute('data-ouvert', 'true');
    languette.setAttribute('aria-expanded', 'true');

    if (!etatCharge) {
      etatCharge = true;
      chargerEtat();
    } else {
      var premier = panneau.querySelector('input, button');
      if (premier) premier.focus();
    }
  }

  function refermer() {
    tiroir.setAttribute('data-ouvert', 'false');
    languette.setAttribute('aria-expanded', 'false');
    panneau.hidden = true;
    languette.focus();
  }

  function estOuvert() {
    return tiroir.getAttribute('data-ouvert') === 'true';
  }

  languette.addEventListener('click', function () {
    if (estOuvert()) refermer();
    else ouvrir();
  });

  if (fermer) fermer.addEventListener('click', refermer);

  document.addEventListener('keydown', function (evt) {
    if (evt.key === 'Escape' && estOuvert()) refermer();
  });

  // Un clic à l'extérieur referme le tiroir.
  document.addEventListener('click', function (evt) {
    if (estOuvert() && !tiroir.contains(evt.target)) refermer();
  });

  /* ---------------------------------------------------------------
   * Contenu du panneau
   * ------------------------------------------------------------- */

  function message(texte, classe) {
    return el('p', { classe: classe || 'tiroir__texte', texte: texte });
  }

  function chargerEtat() {
    vider(corps);
    corps.appendChild(message('Chargement…'));

    appeler('/api/session')
      .then(function (r) {
        if (!r.ok) throw new Error('indisponible');
        if (r.donnees.connecte) rendreConnecte(r.donnees.identifiant);
        else if (r.donnees.compteExiste) rendreConnexion();
        else rendreCreation();
      })
      .catch(function () {
        rendreIndisponible();
      });
  }

  /** Le site est consulté sans son serveur : rien à proposer ici. */
  function rendreIndisponible() {
    vider(corps);
    corps.appendChild(message(
      'L\'espace de modification n\'est pas accessible depuis cette version du site.'
    ));
    corps.appendChild(message(
      'Il faut ouvrir le site servi par son serveur (npm start) pour changer les ' +
      'horaires, la carte ou les événements.',
      'tiroir__aide'
    ));
  }

  /** Première utilisation : on choisit le mot de passe. */
  function rendreCreation() {
    vider(corps);
    corps.appendChild(message(
      'Aucun mot de passe n\'a encore été choisi. Créez-le : il servira ensuite ' +
      'à modifier les horaires, la carte et les événements.'
    ));

    var motDePasse = champMotDePasse('Nouveau mot de passe', 'new-password');
    var confirmation = champMotDePasse('Confirmation', 'new-password');
    var erreur = el('p', { classe: 'tiroir__erreur', attrs: { role: 'alert', hidden: '' } });
    var bouton = el('button', {
      classe: 'bouton bouton--plein tiroir__bouton',
      texte: 'Créer le mot de passe',
      attrs: { type: 'submit' },
    });

    var form = el('form', { classe: 'tiroir__formulaire' }, [
      motDePasse.bloc, confirmation.bloc, erreur, bouton,
      el('p', { classe: 'tiroir__aide', texte: '10 caractères minimum.' }),
    ]);

    form.addEventListener('submit', function (evt) {
      evt.preventDefault();
      erreur.hidden = true;

      if (motDePasse.saisie.value !== confirmation.saisie.value) {
        erreur.textContent = 'Les deux mots de passe ne correspondent pas.';
        erreur.hidden = false;
        return;
      }

      bouton.disabled = true;
      bouton.textContent = 'Création…';

      appeler('/api/installation', {
        methode: 'POST',
        corps: { motDePasse: motDePasse.saisie.value },
      }).then(function (r) {
        if (r.ok) {
          window.location.href = '/admin/';
          return;
        }
        erreur.textContent = r.donnees.erreur || 'Création impossible.';
        erreur.hidden = false;
      }).catch(function () {
        erreur.textContent = 'Le serveur ne répond pas.';
        erreur.hidden = false;
      }).finally(function () {
        bouton.disabled = false;
        bouton.textContent = 'Créer le mot de passe';
      });
    });

    corps.appendChild(form);
    motDePasse.saisie.focus();
  }

  /** Usage courant : on saisit le mot de passe. */
  function rendreConnexion() {
    vider(corps);
    corps.appendChild(message(
      'Entrez le mot de passe pour modifier les horaires, la carte ou les événements.'
    ));

    var motDePasse = champMotDePasse('Mot de passe', 'current-password');
    var erreur = el('p', { classe: 'tiroir__erreur', attrs: { role: 'alert', hidden: '' } });
    var bouton = el('button', {
      classe: 'bouton bouton--plein tiroir__bouton',
      texte: 'Entrer',
      attrs: { type: 'submit' },
    });

    var form = el('form', { classe: 'tiroir__formulaire' }, [motDePasse.bloc, erreur, bouton]);

    form.addEventListener('submit', function (evt) {
      evt.preventDefault();
      erreur.hidden = true;
      bouton.disabled = true;
      bouton.textContent = 'Vérification…';

      appeler('/api/connexion', {
        methode: 'POST',
        corps: { motDePasse: motDePasse.saisie.value },
      }).then(function (r) {
        if (r.ok) {
          window.location.href = '/admin/';
          return;
        }
        erreur.textContent = r.donnees.erreur || 'Connexion impossible.';
        erreur.hidden = false;
        motDePasse.saisie.value = '';
        motDePasse.saisie.focus();
      }).catch(function () {
        erreur.textContent = 'Le serveur ne répond pas.';
        erreur.hidden = false;
      }).finally(function () {
        bouton.disabled = false;
        bouton.textContent = 'Entrer';
      });
    });

    corps.appendChild(form);
    motDePasse.saisie.focus();
  }

  /** Session déjà ouverte : accès direct. */
  function rendreConnecte(identifiant) {
    vider(corps);
    corps.appendChild(message('Connecté' + (identifiant ? ' en tant que ' + identifiant : '') + '.'));

    var lien = el('a', {
      classe: 'bouton bouton--plein tiroir__bouton',
      texte: 'Modifier le site',
      attrs: { href: '/admin/' },
    });

    var deconnexion = el('button', {
      classe: 'bouton tiroir__bouton',
      texte: 'Se déconnecter',
      attrs: { type: 'button' },
    });
    deconnexion.addEventListener('click', function () {
      appeler('/api/deconnexion', { methode: 'POST' }).finally(function () {
        rendreConnexion();
      });
    });

    corps.appendChild(lien);
    corps.appendChild(deconnexion);
  }

  function champMotDePasse(libelle, autocompletion) {
    var id = 'tiroir-mdp-' + Math.random().toString(36).slice(2, 8);
    var saisie = el('input', {
      attrs: { type: 'password', id: id, autocomplete: autocompletion, required: '' },
    });
    var bloc = el('div', { classe: 'champ' }, [
      el('label', { texte: libelle, attrs: { for: id } }),
      saisie,
    ]);
    return { bloc: bloc, saisie: saisie };
  }
})();

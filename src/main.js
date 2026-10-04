import { SUPABASE_URL, SUPABASE_CLE } from "./config.js";

// ---------- Réglages ----------
const NOMS_MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const CLE_THEME = "calendrier.theme";

// ---------- Éléments de la page ----------
const $ = (id) => document.getElementById(id);
const el = {
  titreMois: $("titre-mois"),
  dateDuJour: $("date-du-jour"),
  grille: $("grille"),
  titreJour: $("titre-jour"),
  liste: $("liste-evenements"),
  vide: $("vide"),
  formulaire: $("formulaire"),
  ouvrirAjout: $("ouvrir-ajout"),
  champTitre: $("champ-titre"),
  champDebut: $("champ-debut"),
  champFin: $("champ-fin"),
  message: $("message"),
  calendrier: $("calendrier"),
  connexion: $("connexion"),
  formConnexion: $("form-connexion"),
  champEmail: $("champ-email"),
  champMotDePasse: $("champ-mot-de-passe"),
  erreurConnexion: $("erreur-connexion"),
  jourFormulaire: $("jour-formulaire"),
  zoneHeures: $("zone-heures"),
  voile: $("voile"),
};

// ---------- Supabase ----------
const configOk = SUPABASE_URL.startsWith("https://") && !SUPABASE_CLE.includes("colle");
const client = configOk && window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_CLE) : null;
const COLONNES = "id, jour, titre, debut, fin";

// ---------- État ----------
let aujourdhui = new Date(); // date lue sur l'horloge de Windows
let moisAffiche = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1);
let jourSelectionne = cleDate(aujourdhui);
let evenements = {}; // { "2026-10-02": [{ id, titre, debut, fin }] }, copie locale de la base
let connecte = false;

// ---------- Outils ----------
function cleDate(date) {
  const a = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const j = String(date.getDate()).padStart(2, "0");
  return `${a}-${m}-${j}`;
}

function dateDepuisCle(cle) {
  const [a, m, j] = cle.split("-").map(Number);
  return new Date(a, m - 1, j);
}

function majuscule(texte) {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

function enMinutes(heure) {
  const [h, m] = heure.split(":").map(Number);
  return h * 60 + m;
}

// Un événement sans début ou sans fin compte comme « ponctuel » : part nulle
function partDeLaJournee(ev) {
  if (!ev.debut || !ev.fin) return 0;
  return Math.max(0, enMinutes(ev.fin) - enMinutes(ev.debut)) / (24 * 60);
}

function texteHoraire(ev) {
  if (ev.debut && ev.fin) return `${ev.debut} – ${ev.fin}`;
  return ev.debut || "";
}

// La base renvoie les heures sous la forme "14:30:00" : on garde "14:30"
function versEvenement(ligne) {
  return {
    id: ligne.id,
    titre: ligne.titre,
    debut: ligne.debut ? ligne.debut.slice(0, 5) : "",
    fin: ligne.fin ? ligne.fin.slice(0, 5) : "",
  };
}

function afficherMessage(texte) {
  el.message.textContent = texte;
  el.message.hidden = !texte;
}

// Récupère tous les événements du compte et redessine le calendrier
async function chargerDepuisServeur() {
  if (!client || !connecte) return;
  const { data, error } = await client.from("evenements").select(COLONNES).order("jour");
  if (error) {
    afficherMessage("Connexion au serveur impossible. Les données affichées ne sont peut-être pas à jour.");
    return;
  }
  const nouveaux = {};
  for (const ligne of data) {
    (nouveaux[ligne.jour] ??= []).push(versEvenement(ligne));
  }
  evenements = nouveaux;
  afficherMessage("");
  afficherGrille();
  afficherPanneau();
}

// ---------- Affichage ----------
function afficher() {
  afficherEntete();
  afficherGrille();
  afficherPanneau();
}

function afficherEntete() {
  el.titreMois.textContent =
    `${majuscule(NOMS_MOIS[moisAffiche.getMonth()])} ${moisAffiche.getFullYear()}`;
  el.dateDuJour.textContent = majuscule(
    aujourdhui.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
  );
}

function afficherGrille() {
  const annee = moisAffiche.getFullYear();
  const mois = moisAffiche.getMonth();
  const decalage = (new Date(annee, mois, 1).getDay() + 6) % 7; // semaine qui commence lundi
  const joursDansMois = new Date(annee, mois + 1, 0).getDate();
  const nbSemaines = Math.ceil((decalage + joursDansMois) / 7);
  const cleAujourdhui = cleDate(aujourdhui);

  el.grille.style.gridTemplateRows = `repeat(${nbSemaines}, var(--case))`;
  el.grille.replaceChildren();

  for (let i = 0; i < nbSemaines * 7; i++) {
    const date = new Date(annee, mois, 1 - decalage + i);
    const cle = cleDate(date);
    const nb = evenements[cle]?.length ?? 0;

    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "jour";
    bouton.dataset.cle = cle;

    const numero = document.createElement("span");
    numero.textContent = date.getDate();
    bouton.append(numero);

    // Un petit carré par événement
    if (nb) {
      const marques = document.createElement("span");
      marques.className = "marques";
      marques.setAttribute("aria-hidden", "true");
      const tries = [...evenements[cle]].sort((a, b) =>
        (a.debut || "99:99").localeCompare(b.debut || "99:99")
      );
      for (const ev of tries) {
        const marque = document.createElement("span");
        marque.className = "marque";
        // Part de la journée occupée (0 à 1). La surface du carré y est
        // proportionnelle, donc son côté suit la racine carrée.
        marque.style.setProperty("--racine", Math.sqrt(partDeLaJournee(ev)).toFixed(3));
        marques.append(marque);
      }
      bouton.append(marques);
    }

    bouton.setAttribute(
      "aria-label",
      date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) +
        (nb ? `, ${nb} événement${nb > 1 ? "s" : ""}` : "")
    );

    if (date.getMonth() !== mois) bouton.classList.add("hors-mois");
    if (cle === cleAujourdhui) {
      bouton.classList.add("aujourdhui");
      bouton.setAttribute("aria-current", "date");
    }
    if (cle === jourSelectionne) {
      bouton.classList.add("selectionne");
      bouton.setAttribute("aria-pressed", "true");
    }

    el.grille.append(bouton);
  }
}

// Petites animations de la liste (téléphone uniquement)
function replier(element, absorberEcart = true) {
  const hauteur = element.offsetHeight;
  const fin = { height: "0px", opacity: 0, overflow: "hidden" };
  if (absorberEcart) fin.marginTop = "-0.9rem"; // l'espace avec l'élément du dessus se resserre aussi
  return element
    .animate(
      [{ height: `${hauteur}px`, opacity: 1, overflow: "hidden" }, fin],
      { duration: 240, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" }
    )
    .finished.then(() => true)
    .catch(() => false); // false : animation annulée (rouvert entre-temps)
}

function deplier(element) {
  const hauteur = element.offsetHeight;
  element.animate(
    [
      { height: "0px", opacity: 0, overflow: "hidden" },
      { height: `${hauteur}px`, opacity: 1, overflow: "hidden" },
    ],
    { duration: 280, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
  );
}

function fondu(...elements) {
  for (const e of elements) {
    e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
  }
}

let jourAffichePanneau = null;

function afficherPanneau() {
  jourAffichePanneau = jourSelectionne;
  const date = dateDepuisCle(jourSelectionne);
  el.titreJour.textContent = majuscule(
    date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
  );

  // Événements avec horaire d'abord, dans l'ordre ; ceux sans horaire à la fin
  const liste = [...(evenements[jourSelectionne] ?? [])].sort((a, b) =>
    (a.debut || "99:99").localeCompare(b.debut || "99:99")
  );

  el.liste.replaceChildren();
  for (const ev of liste) {
    const li = document.createElement("li");
    li.className = "evenement";
    li.dataset.id = ev.id;

    const horaire = document.createElement("span");
    horaire.className = "heure";
    horaire.textContent = texteHoraire(ev);

    const titre = document.createElement("span");
    titre.className = "titre";
    titre.textContent = ev.titre;

    const supprimer = document.createElement("button");
    supprimer.type = "button";
    supprimer.className = "supprimer";
    supprimer.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5 L19 19 M19 5 L5 19" /></svg>';
    supprimer.setAttribute("aria-label", `Supprimer ${ev.titre}`);
    supprimer.title = "Supprimer";
    supprimer.addEventListener("click", async () => {
      // Sur téléphone, l'événement se replie avant de disparaître
      if (!mouvementReduit) {
        await replier(li);
      }
      supprimerEvenement(ev.id);
    });

    const contenu = document.createElement("div");
    contenu.className = "contenu";
    contenu.append(horaire, titre);

    li.append(contenu, supprimer);
    el.liste.append(li);
  }

  el.vide.hidden = liste.length > 0;
}

// ---------- Actions ----------
// Sur téléphone, quand le contenu raccourcit (jour avec moins d'événements,
// suppression), la page remonterait d'un coup. On garde un instant l'ancienne
// hauteur, on remonte en douceur juste ce qu'il faut, puis on la relâche.
function afficherEnDouceur(miseAJour) {
  const cadre = el.calendrier;
  const panneau = el.liste.closest(".panneau");
  if (!estMobile || mouvementReduit || cadre.scrollTop === 0) {
    miseAJour();
    return;
  }
  panneau.style.minHeight = `${panneau.offsetHeight}px`;
  miseAJour();
  const naturel = el.ouvrirAjout.getBoundingClientRect().bottom - panneau.getBoundingClientRect().top;
  const enTrop = Math.max(0, panneau.offsetHeight - naturel);
  const cible = Math.max(0, Math.min(cadre.scrollTop, cadre.scrollHeight - enTrop - cadre.clientHeight));
  const liberer = () => { panneau.style.minHeight = ""; };
  if (cible >= cadre.scrollTop - 1) {
    liberer();
    return;
  }
  cadre.scrollTo({ top: cible, behavior: "smooth" });
  let fini = false;
  const terminer = () => { if (!fini) { fini = true; liberer(); } };
  cadre.addEventListener("scrollend", terminer, { once: true });
  setTimeout(terminer, 600); // au cas où « scrollend » n'arrive pas
}

function selectionnerJour(cle) {
  jourSelectionne = cle;
  const date = dateDepuisCle(cle);
  if (date.getMonth() !== moisAffiche.getMonth() || date.getFullYear() !== moisAffiche.getFullYear()) {
    moisAffiche = new Date(date.getFullYear(), date.getMonth(), 1);
  }
  const autreJour = cle !== jourAffichePanneau;
  afficherEnDouceur(afficher);
  if (autreJour && !mouvementReduit) fondu(el.titreJour, el.liste, el.vide);
  el.grille.querySelector(`[data-cle="${cle}"]`)?.focus({ preventScroll: true });
}

function changerMois(ecart) {
  moisAffiche = new Date(moisAffiche.getFullYear(), moisAffiche.getMonth() + ecart, 1);
  afficher();
}

async function ajouterEvenement(titre, debut, fin) {
  const jour = jourSelectionne;
  const { data, error } = await client
    .from("evenements")
    .insert({ jour, titre, debut: debut || null, fin: fin || null })
    .select(COLONNES)
    .single();
  if (error) {
    afficherMessage("L'événement n'a pas pu être enregistré. Vérifie ta connexion et réessaie.");
    return false;
  }
  (evenements[jour] ??= []).push(versEvenement(data));
  afficherMessage("");
  return true;
}

async function supprimerEvenement(id) {
  const jour = jourSelectionne;
  const { error } = await client.from("evenements").delete().eq("id", id);
  if (error) {
    afficherMessage("La suppression n'a pas pu se faire. Vérifie ta connexion et réessaie.");
    return;
  }
  const reste = (evenements[jour] ?? []).filter((ev) => ev.id !== id);
  if (reste.length) evenements[jour] = reste;
  else delete evenements[jour];
  afficherMessage("");
  afficherEnDouceur(afficher);
}

// Vérifie que la fin vient après le début, et qu'une fin a bien un début
function verifierHoraires() {
  const debut = el.champDebut.value;
  const fin = el.champFin.value;
  let message = "";
  if (fin && !debut) message = "Indique aussi une heure de début.";
  else if (debut && fin && fin <= debut) message = "L'heure de fin doit être après l'heure de début.";
  el.champFin.setCustomValidity(message);
}

// ---------- Sélecteur d'heure maison : heures à gauche, minutes à droite ----------
const HEURES = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

let listeOuverte = null;

// La liste se replie au lieu de disparaître d'un coup : l'écran remonte
// en douceur au lieu de sauter quand la place qu'elle occupait disparaît
function fermerListeHeures() {
  const liste = listeOuverte;
  listeOuverte = null;
  if (!liste) return;
  $(liste.dataset.pour)?.classList.remove("actif");
  if (mouvementReduit) {
    liste.remove();
    return;
  }
  liste.style.pointerEvents = "none";
  liste
    .animate(
      [{ height: `${liste.offsetHeight}px`, opacity: 1 }, { height: "0px", opacity: 0 }],
      { duration: 260, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
    )
    .finished.then(() => liste.remove());
}

function creerColonne(valeurs, nom, auChoix) {
  const colonne = document.createElement("ul");
  colonne.className = "colonne";
  colonne.setAttribute("role", "listbox");
  colonne.setAttribute("aria-label", nom);
  for (const valeur of valeurs) {
    const li = document.createElement("li");
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.tabIndex = -1;
    bouton.textContent = valeur;
    bouton.dataset.valeur = valeur;
    bouton.setAttribute("role", "option");
    // mousedown + preventDefault : le champ garde le focus pendant le clic
    bouton.addEventListener("mousedown", (e) => e.preventDefault());
    // Le sélecteur est dans le <label> : on évite que le clic soit renvoyé au champ
    bouton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      auChoix(valeur);
    });
    li.append(bouton);
    colonne.append(li);
  }
  return colonne;
}

function marquer(colonne, valeur) {
  for (const bouton of colonne.querySelectorAll("button")) {
    bouton.setAttribute("aria-selected", String(bouton.dataset.valeur === valeur));
  }
}

function ouvrirListeHeures(champ) {
  fermerListeHeures();
  // Une liste encore en train de se replier laisse aussitôt la place
  document.querySelectorAll(".liste-heures").forEach((l) => l.remove());

  // Heure de référence pour placer les colonnes : la valeur du champ,
  // sinon début + 1h pour la fin, sinon 08:00
  let reference = champ.value;
  if (!reference && champ === el.champFin && el.champDebut.value) {
    const [h, m] = el.champDebut.value.split(":");
    reference = `${String(Math.min(Number(h) + 1, 23)).padStart(2, "0")}:${m}`;
  }
  reference ||= "08:00";
  const [hRef, mRef] = reference.split(":");

  const ecrire = (h, m) => {
    champ.value = `${h}:${m}`;
    champ.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const valeurActuelle = () => (champ.value ? champ.value.split(":") : [null, null]);

  // Choisir l'heure : on garde les minutes déjà choisies (ou :00), la liste reste ouverte
  const colonneHeures = creerColonne(HEURES, "Heures", (h) => {
    const [, m] = valeurActuelle();
    ecrire(h, m ?? "00");
    marquer(colonneHeures, h);
    marquer(colonneMinutes, m ?? "00");
  });

  // Choisir les minutes : on garde l'heure (ou celle de référence).
  // Sur PC, la liste se ferme ; sur téléphone, elle reste ouverte pour pouvoir
  // corriger un mauvais toucher (elle se ferme en touchant ailleurs)
  const colonneMinutes = creerColonne(MINUTES, "Minutes", (m) => {
    const [h] = valeurActuelle();
    ecrire(h ?? hRef, m);
    marquer(colonneHeures, h ?? hRef);
    marquer(colonneMinutes, m);
    if (!estMobile) fermerListeHeures();
  });

  const [hVal, mVal] = valeurActuelle();
  if (hVal) marquer(colonneHeures, hVal);
  if (mVal) marquer(colonneMinutes, mVal);

  const conteneur = document.createElement("div");
  conteneur.className = "liste-heures";
  conteneur.append(colonneHeures, colonneMinutes);
  conteneur.dataset.pour = champ.id;
  // Sur téléphone, sous les champs sur toute la largeur ; sur PC, sous le champ
  (estMobile ? el.zoneHeures : champ.closest("label")).append(conteneur);
  champ.classList.add("actif");
  listeOuverte = conteneur;

  // On fait défiler chaque colonne jusqu'à la valeur de référence
  const viser = (colonne, valeur) => {
    const cible = [...colonne.querySelectorAll("button")].find((b) => b.dataset.valeur >= valeur);
    if (cible) colonne.scrollTop = cible.parentElement.offsetTop;
  };
  viser(colonneHeures, hRef);
  viser(colonneMinutes, mRef);

  // Sur téléphone : la liste se déplie, et l'écran descend pour la montrer
  if (!mouvementReduit) {
    conteneur.animate(
      [{ height: "0px", opacity: 0 }, { height: `${conteneur.offsetHeight}px`, opacity: 1 }],
      { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
    );
  }
  if (!estMobile) conteneur.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// ---------- Sélecteur d'heure sur téléphone : toujours affiché dans le panneau ----------
// Les colonnes restent en place tant que le panneau est ouvert : toucher « Début »
// ou « Fin » change seulement le champ qu'elles remplissent, sans rien replier.
let champCible = null;
let selecteurMobile = null;

function referenceDe(champ) {
  let reference = champ.value;
  if (!reference && champ === el.champFin && el.champDebut.value) {
    const [h, m] = el.champDebut.value.split(":");
    reference = `${String(Math.min(Number(h) + 1, 23)).padStart(2, "0")}:${m}`;
  }
  return (reference || "08:00").split(":");
}

function construireSelecteurMobile() {
  const valeur = () => (champCible.value ? champCible.value.split(":") : [null, null]);
  const ecrire = (h, m) => {
    champCible.value = `${h}:${m}`;
    champCible.dispatchEvent(new Event("input", { bubbles: true }));
    marquerSelecteur();
  };
  const heures = creerColonne(HEURES, "Heures", (h) => {
    const [, m] = valeur();
    ecrire(h, m ?? "00");
  });
  const minutes = creerColonne(MINUTES, "Minutes", (m) => {
    const [h] = valeur();
    ecrire(h ?? referenceDe(champCible)[0], m);
  });
  selecteurMobile = document.createElement("div");
  selecteurMobile.className = "liste-heures";
  selecteurMobile.append(heures, minutes);
  el.zoneHeures.replaceChildren(selecteurMobile);
}

function marquerSelecteur() {
  if (!champCible || !selecteurMobile) return;
  const [h, m] = champCible.value ? champCible.value.split(":") : [null, null];
  const [heures, minutes] = selecteurMobile.querySelectorAll(".colonne");
  marquer(heures, h);
  marquer(minutes, m);
}

function ciblerChamp(champ, enDouceur = true) {
  // Premier toucher sur une heure : les colonnes se déplient (elles restent
  // ensuite dépliées jusqu'à la fermeture du panneau)
  if (el.zoneHeures.hidden) {
    el.zoneHeures.hidden = false;
    enDouceur = false; // on place les colonnes d'emblée, c'est le dépliement qui anime
    if (!mouvementReduit) {
      el.zoneHeures.animate(
        [
          { height: "0px", opacity: 0, overflow: "hidden" },
          { height: `${el.zoneHeures.offsetHeight}px`, opacity: 1, overflow: "hidden" },
        ],
        { duration: 260, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
      );
    }
  }
  champCible = champ;
  el.champDebut.classList.toggle("actif", champ === el.champDebut);
  el.champFin.classList.toggle("actif", champ === el.champFin);
  marquerSelecteur();
  // Les colonnes défilent jusqu'à l'heure utile, sans que le panneau bouge
  const [hRef, mRef] = referenceDe(champ);
  const [heures, minutes] = selecteurMobile.querySelectorAll(".colonne");
  for (const [colonne, valeur] of [[heures, hRef], [minutes, mRef]]) {
    const bouton = [...colonne.querySelectorAll("button")].find((b) => b.dataset.valeur >= valeur);
    if (bouton) colonne.scrollTo({ top: bouton.parentElement.offsetTop, behavior: enDouceur ? "smooth" : "auto" });
  }
}

for (const champ of [el.champDebut, el.champFin]) {
  champ.addEventListener("click", () => {
    if (estMobile) {
      ciblerChamp(champ);
      return;
    }
    if (!listeOuverte || listeOuverte.dataset.pour !== champ.id) ouvrirListeHeures(champ);
  });
  champ.addEventListener("blur", () => {
    if (!estMobile) fermerListeHeures();
  });
  champ.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && listeOuverte) fermerListeHeures();
  });
}

// ---------- Ouverture / fermeture du formulaire ----------
let ouvertureFormulaire = 0;

function ouvrirFormulaire() {
  el.formulaire.getAnimations().forEach((a) => a.cancel());
  el.voile.getAnimations().forEach((a) => a.cancel());
  el.formulaire.hidden = false;
  el.ouvrirAjout.hidden = true;

  if (estMobile) {
    // Le panneau monte du bas de l'écran, la page s'efface derrière un voile
    ouvertureFormulaire = Date.now();
    el.jourFormulaire.textContent = majuscule(
      dateDepuisCle(jourSelectionne).toLocaleDateString("fr-FR", {
        weekday: "long", day: "numeric", month: "long",
      })
    );
    el.voile.hidden = false;
    // À l'ouverture : juste le titre (et le clavier). Les heures attendent
    // qu'on touche « Début » ou « Fin » pour se déplier.
    construireSelecteurMobile();
    champCible = null;
    el.zoneHeures.hidden = true;
    if (!mouvementReduit) {
      el.formulaire.animate(
        [{ transform: "translateY(calc(100% + 20px))" }, { transform: "translateY(0)" }],
        { duration: 280, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
      );
      el.voile.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280 });
    }
  } else {
    if (!mouvementReduit) deplier(el.formulaire);
    el.formulaire.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  el.champTitre.focus();
}

function fermerFormulaire() {
  if (!estMobile) {
    fermerListeHeures();
    document.querySelectorAll(".liste-heures").forEach((l) => l.remove());
  }
  el.champFin.setCustomValidity("");
  const afficherBoutonAjout = (delai) => {
    el.ouvrirAjout.hidden = false;
    if (!mouvementReduit) {
      el.ouvrirAjout.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: delai, fill: "backwards" });
    }
  };

  const terminer = () => {
    el.formulaire.reset();
    el.formulaire.hidden = true;
    el.voile.hidden = true;
    el.zoneHeures.replaceChildren();
    el.zoneHeures.hidden = true;
    champCible = null;
    el.champDebut.classList.remove("actif");
    el.champFin.classList.remove("actif");
  };
  if (mouvementReduit || el.formulaire.hidden) {
    terminer();
    el.ouvrirAjout.hidden = false;
    return;
  }
  if (!estMobile) {
    // Sur PC : le formulaire se replie, puis « Ajouter » revient en fondu
    replier(el.formulaire, false).then((termine) => {
      if (!termine) return;
      terminer();
      el.formulaire.getAnimations().forEach((a) => a.cancel());
      afficherBoutonAjout(0);
    });
    return;
  }
  afficherBoutonAjout(150);
  // Le panneau redescend, puis disparaît
  document.activeElement?.blur(); // range le clavier
  el.voile.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" })
    .finished.then((a) => { el.voile.hidden = true; a.cancel(); })
    .catch(() => {}); // réouvert entre-temps : on ne touche à rien
  el.formulaire
    .animate(
      [{ transform: "translateY(0)" }, { transform: "translateY(calc(100% + 20px))" }],
      // Démarre en douceur et ralentit en fin de course : plus de retour « sec »
      { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" }
    )
    .finished.then((a) => {
      terminer();
      a.cancel();
    })
    .catch(() => {});
}

// ---------- Téléphone ----------
const estMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
if (estMobile) {
  document.documentElement.classList.add("mobile");
  // Retour visuel au doigt : le bouton touché porte la classe « appuye »
  // jusqu'au relâchement (ou jusqu'à ce que le doigt parte faire défiler)
  let boutonAppuye = null;
  const relacher = () => {
    boutonAppuye?.classList.remove("appuye");
    boutonAppuye = null;
  };
  let pointDepart = null;
  document.addEventListener("pointerdown", (e) => {
    relacher();
    pointDepart = { x: e.clientX, y: e.clientY };
    boutonAppuye = e.target.closest("button");
    boutonAppuye?.classList.add("appuye");
  });
  // Si le doigt se met à glisser (changer de mois, défiler), ce n'est plus un appui
  document.addEventListener("pointermove", (e) => {
    if (boutonAppuye && Math.hypot(e.clientX - pointDepart.x, e.clientY - pointDepart.y) > 10) relacher();
  });
  for (const type of ["pointerup", "pointercancel"]) {
    document.addEventListener(type, relacher);
  }
  // Les champs d'heure ne s'écrivent qu'avec notre sélecteur :
  // sinon Android ouvre en plus sa propre horloge
  el.champDebut.readOnly = true;
  el.champFin.readOnly = true;
  // Le formulaire flotte au-dessus de tout : on le sort du cadre pour qu'il
  // passe devant le voile (sinon il resterait « dans » le cadre, derrière)
  document.body.append(el.formulaire);
}

// ---------- Fenêtre (Tauri) ----------
// En dehors de Tauri (dans un navigateur), ces fonctions ne font rien
const fenetre = window.__TAURI__?.window?.getCurrentWindow();

async function basculerPleinEcran() {
  if (!fenetre) return;
  const plein = await fenetre.isFullscreen();
  await fenetre.setFullscreen(!plein);
}

if (fenetre && !estMobile) {
  $("fenetre-reduire").addEventListener("click", () => fenetre.minimize());
  $("fenetre-agrandir").addEventListener("click", () => fenetre.toggleMaximize());
  $("fenetre-fermer").addEventListener("click", () => fenetre.close());
} else {
  document.querySelector(".controles").hidden = true;
}

// ---------- Thème ----------
function appliquerTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll("[data-theme-choix]").forEach((bouton) => {
    bouton.setAttribute("aria-pressed", String(bouton.dataset.themeChoix === theme));
  });
  try {
    localStorage.setItem(CLE_THEME, theme);
  } catch {
    // pas grave si le choix n'est pas retenu
  }
}

// ---------- Écouteurs ----------
$("mois-precedent").addEventListener("click", () => naviguerMois(-1));
$("mois-suivant").addEventListener("click", () => naviguerMois(1));
$("aller-aujourdhui").addEventListener("click", async () => {
  const cle = cleDate(aujourdhui);
  const ecart =
    (aujourdhui.getFullYear() - moisAffiche.getFullYear()) * 12 + aujourdhui.getMonth() - moisAffiche.getMonth();
  if (ecart && !mouvementReduit) {
    // Une seule glissade dans le bon sens, même si on était loin
    await naviguerMois(Math.sign(ecart), 0, () => {
      jourSelectionne = cle;
      moisAffiche = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1);
      afficher();
    });
  } else {
    selectionnerJour(cle);
  }
  if (estMobile) el.calendrier.scrollTo({ top: 0, behavior: mouvementReduit ? "auto" : "smooth" });
});

el.grille.addEventListener("click", (e) => {
  const jour = e.target.closest(".jour");
  if (jour) selectionnerJour(jour.dataset.cle);
});

// Double-clic sur un jour : on ouvre directement le formulaire
el.grille.addEventListener("dblclick", (e) => {
  if (e.target.closest(".jour")) ouvrirFormulaire();
});

// Au doigt : la grille suit le doigt, puis glisse vers le mois suivant ou précédent
const zoneMois = el.grille.closest(".mois");
const mouvementReduit = matchMedia("(prefers-reduced-motion: reduce)").matches;
let glisse = null; // { x, y, sens: null | "h" | "v" }
let animationEnCours = false;

// Change de mois avec une glissade : l'ancien mois part d'un côté, le nouveau arrive de l'autre.
// « depart » : décalage actuel de la grille (en px) quand on suit le doigt
async function naviguerMois(ecart, depart = 0, changement = () => changerMois(ecart)) {
  if (mouvementReduit) {
    changement();
    return;
  }
  if (animationEnCours) return;
  animationEnCours = true;
  const largeur = zoneMois.clientWidth;
  const sortie = ecart > 0 ? -largeur : largeur;

  await el.grille.animate(
    [
      { transform: `translateX(${depart}px)`, opacity: 1 - Math.min(Math.abs(depart) / largeur, 0.6) },
      { transform: `translateX(${sortie * 0.6}px)`, opacity: 0 },
    ],
    { duration: 160, easing: "ease-in", fill: "forwards" }
  ).finished;

  changement();
  fondu(el.titreMois);

  const arrivee = el.grille.animate(
    [
      { transform: `translateX(${-sortie * 0.4}px)`, opacity: 0 },
      { transform: "translateX(0)", opacity: 1 },
    ],
    { duration: 240, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
  );
  // On efface l'animation de sortie restée « figée » sur la grille
  el.grille.getAnimations().forEach((a) => a !== arrivee && a.cancel());
  await arrivee.finished;
  animationEnCours = false;
}

zoneMois.addEventListener("touchstart", (e) => {
  if (animationEnCours) return;
  const t = e.touches[0];
  glisse = { x: t.clientX, y: t.clientY, sens: null };
}, { passive: true });

zoneMois.addEventListener("touchmove", (e) => {
  if (!glisse) return;
  const t = e.touches[0];
  const dx = t.clientX - glisse.x;
  const dy = t.clientY - glisse.y;
  // On décide une fois pour toutes : geste horizontal (mois) ou vertical (défilement)
  if (!glisse.sens && Math.hypot(dx, dy) > 10) {
    glisse.sens = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
  }
  if (glisse.sens !== "h" || mouvementReduit) return;
  const largeur = zoneMois.clientWidth;
  el.grille.style.transform = `translateX(${dx}px)`;
  el.grille.style.opacity = String(1 - Math.min(Math.abs(dx) / largeur, 0.6));
}, { passive: true });

function finirGlisse(e) {
  if (!glisse) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - glisse.x;
  const horizontal = glisse.sens === "h";
  glisse = null;
  el.grille.style.transform = "";
  el.grille.style.opacity = "";
  if (!horizontal) return;

  if (Math.abs(dx) > 50) {
    naviguerMois(dx < 0 ? 1 : -1, dx);
  } else if (!mouvementReduit) {
    // Pas assez loin : la grille revient en place
    el.grille.animate(
      [{ transform: `translateX(${dx}px)` }, { transform: "translateX(0)" }],
      { duration: 200, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
    );
  }
}
zoneMois.addEventListener("touchend", finirGlisse);
zoneMois.addEventListener("touchcancel", finirGlisse);

// Au doigt : glisser un événement vers la gauche découvre le bouton de suppression
let glisseEv = null; // { li, x, y, sens, base }

function fermerEvenements(sauf) {
  el.liste.querySelectorAll(".evenement.ouvert").forEach((li) => li !== sauf && li.classList.remove("ouvert"));
}

el.liste.addEventListener("touchstart", (e) => {
  const li = e.target.closest(".evenement");
  if (!li || e.target.closest(".supprimer")) return;
  const t = e.touches[0];
  const largeur = li.querySelector(".supprimer").offsetWidth;
  glisseEv = { li, x: t.clientX, y: t.clientY, sens: null, base: li.classList.contains("ouvert") ? -largeur : 0, largeur };
}, { passive: true });

el.liste.addEventListener("touchmove", (e) => {
  if (!glisseEv) return;
  const t = e.touches[0];
  const dx = t.clientX - glisseEv.x;
  const dy = t.clientY - glisseEv.y;
  if (!glisseEv.sens && Math.hypot(dx, dy) > 10) glisseEv.sens = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
  if (glisseEv.sens !== "h") return;
  // Le bloc suit le doigt, sans dépasser un peu plus que la largeur du bouton
  const decalage = Math.max(-glisseEv.largeur * 1.3, Math.min(0, glisseEv.base + dx));
  const contenu = glisseEv.li.querySelector(".contenu");
  contenu.style.transition = "none";
  contenu.style.transform = `translateX(${decalage}px)`;
  glisseEv.decalage = decalage;
}, { passive: true });

function finirGlisseEv() {
  if (!glisseEv) return;
  const { li, sens, decalage, largeur } = glisseEv;
  glisseEv = null;
  const contenu = li.querySelector(".contenu");
  contenu.style.transition = "";
  contenu.style.transform = "";
  if (sens === "h") {
    const ouvrir = decalage < -largeur / 2;
    li.classList.toggle("ouvert", ouvrir);
    if (ouvrir) fermerEvenements(li);
  } else if (!sens) {
    // Simple toucher sur un événement ouvert : il se referme
    li.classList.remove("ouvert");
  }
}
el.liste.addEventListener("touchend", finirGlisseEv);
el.liste.addEventListener("touchcancel", finirGlisseEv);

// Toucher ailleurs dans l'app referme l'événement ouvert
document.addEventListener("touchstart", (e) => {
  if (!e.target.closest(".evenement")) fermerEvenements();
}, { passive: true });

// Pas de menu contextuel du navigateur sur un appui long
el.grille.addEventListener("contextmenu", (e) => e.preventDefault());

el.ouvrirAjout.addEventListener("click", ouvrirFormulaire);
// Quand le clavier s'ouvre ou se ferme, Android redimensionne l'écran d'un coup
// et le panneau saute. On le replace là où il était, puis on le fait glisser
// jusqu'à sa nouvelle position.
let hauteurEcran = window.innerHeight;

// Hauteur de la page, figée clavier fermé : le clavier ne la fait plus rétrécir
const champSaisie = () => document.activeElement?.matches?.('input:not([readonly]), textarea');
function figerHauteurPage() {
  document.documentElement.style.setProperty("--hauteur-ecran", `${window.innerHeight}px`);
}
if (estMobile) figerHauteurPage();

window.addEventListener("resize", () => {
  const ecart = window.innerHeight - hauteurEcran;
  hauteurEcran = window.innerHeight;
  // L'écran grandit (clavier rangé) ou change sans clavier (rotation) : on suit.
  // Il rétrécit pendant une saisie : c'est le clavier, la page garde sa hauteur.
  if (estMobile && (ecart > 0 || !champSaisie())) figerHauteurPage();
  if (!estMobile || mouvementReduit || el.formulaire.hidden || !ecart) return;
  el.formulaire.animate(
    [{ transform: `translateY(${-ecart}px)` }, { transform: "translateY(0)" }],
    { duration: 260, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", composite: "add" }
  );
});

// Toucher le voile ferme le formulaire (sauf juste après l'ouverture :
// le doigt de l'appui long est peut-être encore en train de se relever)
el.voile.addEventListener("click", () => {
  if (Date.now() - ouvertureFormulaire > 500) fermerFormulaire();
});
$("annuler").addEventListener("click", fermerFormulaire);

el.champDebut.addEventListener("input", verifierHoraires);
el.champFin.addEventListener("input", verifierHoraires);

let enregistrementEnCours = false;

el.formulaire.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (enregistrementEnCours) return;
  verifierHoraires();
  if (!el.formulaire.reportValidity()) return;

  const titre = el.champTitre.value.trim();
  if (!titre) return;

  enregistrementEnCours = true;
  const ok = await ajouterEvenement(titre, el.champDebut.value, el.champFin.value);
  enregistrementEnCours = false;
  if (!ok) return; // le formulaire reste ouvert pour réessayer

  fermerFormulaire();
  const avant = new Set([...el.liste.children].map((li) => li.dataset.id));
  afficherGrille();
  afficherPanneau();
  if (!mouvementReduit) {
    [...el.liste.children].filter((li) => !avant.has(li.dataset.id)).forEach(deplier);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "F11") {
    e.preventDefault();
    basculerPleinEcran();
    return;
  }
  if (e.key !== "Escape") return;
  if (listeOuverte) fermerListeHeures(); // Échap ferme d'abord la liste des heures
  else if (!el.formulaire.hidden) fermerFormulaire();
});

document.querySelectorAll("[data-theme-choix]").forEach((bouton) => {
  bouton.addEventListener("click", () => {
    const theme = bouton.dataset.themeChoix;
    if (theme === document.documentElement.dataset.theme) return;
    // Passage clair / sombre en fondu au lieu d'un basculement sec
    if (document.startViewTransition && !mouvementReduit) {
      document.startViewTransition(() => appliquerTheme(theme));
    } else {
      appliquerTheme(theme);
    }
  });
});

// ---------- Connexion ----------
function montrerEcran(estConnecte) {
  connecte = estConnecte;
  el.calendrier.hidden = !estConnecte;
  el.connexion.hidden = estConnecte;
  $("deconnexion").hidden = !estConnecte;
  if (estConnecte) {
    chargerDepuisServeur();
  } else {
    evenements = {};
    fermerFormulaire();
    afficher();
    el.champEmail.focus();
  }
}

el.formConnexion.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!client) return;
  el.erreurConnexion.hidden = true;

  const { error } = await client.auth.signInWithPassword({
    email: el.champEmail.value.trim(),
    password: el.champMotDePasse.value,
  });
  if (error) {
    el.erreurConnexion.textContent =
      error.status === 400
        ? "E-mail ou mot de passe incorrect."
        : "Connexion au serveur impossible. Vérifie ta connexion internet.";
    el.erreurConnexion.hidden = false;
    return;
  }
  el.formConnexion.reset();
});

$("deconnexion").addEventListener("click", () => client?.auth.signOut());

// ---------- Synchronisation ----------
// On relit la base quand on revient sur la fenêtre, et toutes les minutes
window.addEventListener("focus", chargerDepuisServeur);
// Sur téléphone, on revient dans l'app sans « focus » de fenêtre
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") chargerDepuisServeur();
});
setInterval(chargerDepuisServeur, 60 * 1000);

// ---------- Passage à minuit ----------
// Toutes les minutes, on relit l'horloge : si le jour a changé, on met tout à jour
setInterval(() => {
  const maintenant = new Date();
  if (cleDate(maintenant) === cleDate(aujourdhui)) return;

  const ancienneCle = cleDate(aujourdhui);
  const ancienMois = aujourdhui.getMonth();
  aujourdhui = maintenant;

  // Si on regardait « aujourd'hui », on suit le nouveau jour
  if (jourSelectionne === ancienneCle) {
    jourSelectionne = cleDate(aujourdhui);
    if (moisAffiche.getMonth() === ancienMois) {
      moisAffiche = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1);
    }
  }
  afficher();
}, 60 * 1000);

// ---------- Démarrage ----------
let themeInitial = "dark";
try {
  themeInitial = localStorage.getItem(CLE_THEME) ?? "dark";
} catch {
  // on reste en sombre
}
appliquerTheme(themeInitial);
afficher();

if (!client) {
  // Configuration absente ou bibliothèque Supabase introuvable
  el.connexion.hidden = false;
  el.erreurConnexion.textContent = !configOk
    ? "Renseigne l'URL et la clé de ton projet dans src/config.js."
    : "Bibliothèque Supabase introuvable : vérifie le fichier src/lib/supabase.js.";
  el.erreurConnexion.hidden = false;
} else {
  // Supabase mémorise la session : si on s'est déjà connecté, on arrive direct au calendrier
  const { data } = await client.auth.getSession();
  montrerEcran(Boolean(data.session));
  client.auth.onAuthStateChange((evenement, session) => {
    if (evenement === "SIGNED_IN" && !connecte) montrerEcran(true);
    if (evenement === "SIGNED_OUT") montrerEcran(false);
    if (!session && connecte) montrerEcran(false);
  });
}

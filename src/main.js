// ---------- Réglages ----------
const NOMS_MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const CLE_EVENEMENTS = "calendrier.evenements";
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
};

// ---------- État ----------
const aujourdhui = new Date();
let moisAffiche = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1);
let jourSelectionne = cleDate(aujourdhui);
let evenements = chargerEvenements(); // { "2026-10-02": [{ id, titre, debut, fin }] }

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

function texteHoraire(ev) {
  if (ev.debut && ev.fin) return `${ev.debut} – ${ev.fin}`;
  return ev.debut || "";
}

// Stockage local provisoire : remplacé par Supabase à l'étape suivante
function chargerEvenements() {
  try {
    const donnees = JSON.parse(localStorage.getItem(CLE_EVENEMENTS)) ?? {};
    // Les événements créés avec l'ancienne version avaient une seule « heure »
    for (const liste of Object.values(donnees)) {
      for (const ev of liste) {
        if (ev.heure !== undefined && ev.debut === undefined) {
          ev.debut = ev.heure;
          ev.fin = "";
          delete ev.heure;
        }
      }
    }
    return donnees;
  } catch {
    return {};
  }
}

function sauvegarderEvenements() {
  try {
    localStorage.setItem(CLE_EVENEMENTS, JSON.stringify(evenements));
  } catch {
    // stockage indisponible : on garde les données en mémoire
  }
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
    aujourdhui.toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    })
  );
}

function afficherGrille() {
  const annee = moisAffiche.getFullYear();
  const mois = moisAffiche.getMonth();
  const decalage = (new Date(annee, mois, 1).getDay() + 6) % 7; // semaine qui commence lundi
  const joursDansMois = new Date(annee, mois + 1, 0).getDate();
  const nbSemaines = Math.ceil((decalage + joursDansMois) / 7);
  const cleAujourdhui = cleDate(aujourdhui);

  el.grille.style.gridTemplateRows = `repeat(${nbSemaines}, minmax(0, 1fr))`;
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
      for (let k = 0; k < nb; k++) {
        const marque = document.createElement("span");
        marque.className = "marque";
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

function afficherPanneau() {
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

    const horaire = document.createElement("span");
    horaire.className = "heure";
    horaire.textContent = texteHoraire(ev);

    const titre = document.createElement("span");
    titre.textContent = ev.titre;

    const supprimer = document.createElement("button");
    supprimer.type = "button";
    supprimer.className = "supprimer";
    supprimer.textContent = "Supprimer";
    supprimer.setAttribute("aria-label", `Supprimer ${ev.titre}`);
    supprimer.addEventListener("click", () => supprimerEvenement(ev.id));

    li.append(horaire, titre, supprimer);
    el.liste.append(li);
  }

  el.vide.hidden = liste.length > 0;
}

// ---------- Actions ----------
function selectionnerJour(cle) {
  jourSelectionne = cle;
  const date = dateDepuisCle(cle);
  if (date.getMonth() !== moisAffiche.getMonth() || date.getFullYear() !== moisAffiche.getFullYear()) {
    moisAffiche = new Date(date.getFullYear(), date.getMonth(), 1);
  }
  afficher();
  el.grille.querySelector(`[data-cle="${cle}"]`)?.focus();
}

function changerMois(ecart) {
  moisAffiche = new Date(moisAffiche.getFullYear(), moisAffiche.getMonth() + ecart, 1);
  afficher();
}

function ajouterEvenement(titre, debut, fin) {
  const liste = evenements[jourSelectionne] ?? [];
  liste.push({ id: crypto.randomUUID(), titre, debut, fin });
  evenements[jourSelectionne] = liste;
  sauvegarderEvenements();
}

function supprimerEvenement(id) {
  const reste = (evenements[jourSelectionne] ?? []).filter((ev) => ev.id !== id);
  if (reste.length) evenements[jourSelectionne] = reste;
  else delete evenements[jourSelectionne];
  sauvegarderEvenements();
  afficher();
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

// ---------- Ouverture / fermeture du formulaire ----------
function ouvrirFormulaire() {
  el.formulaire.hidden = false;
  el.ouvrirAjout.hidden = true;
  el.champTitre.focus();
}

function fermerFormulaire() {
  el.formulaire.reset();
  el.champFin.setCustomValidity("");
  el.formulaire.hidden = true;
  el.ouvrirAjout.hidden = false;
}

// ---------- Fenêtre (Tauri) ----------
// En dehors de Tauri (dans un navigateur), ces fonctions ne font rien
const fenetre = window.__TAURI__?.window?.getCurrentWindow();

async function basculerPleinEcran() {
  if (!fenetre) return;
  const plein = await fenetre.isFullscreen();
  await fenetre.setFullscreen(!plein);
}

if (fenetre) {
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
$("mois-precedent").addEventListener("click", () => changerMois(-1));
$("mois-suivant").addEventListener("click", () => changerMois(1));
$("aller-aujourdhui").addEventListener("click", () => selectionnerJour(cleDate(aujourdhui)));

el.grille.addEventListener("click", (e) => {
  const jour = e.target.closest(".jour");
  if (jour) selectionnerJour(jour.dataset.cle);
});

// Double-clic sur un jour : on ouvre directement le formulaire
el.grille.addEventListener("dblclick", (e) => {
  if (e.target.closest(".jour")) ouvrirFormulaire();
});

el.ouvrirAjout.addEventListener("click", ouvrirFormulaire);
$("annuler").addEventListener("click", fermerFormulaire);

el.champDebut.addEventListener("input", verifierHoraires);
el.champFin.addEventListener("input", verifierHoraires);

el.formulaire.addEventListener("submit", (e) => {
  e.preventDefault();
  verifierHoraires();
  if (!el.formulaire.reportValidity()) return;

  const titre = el.champTitre.value.trim();
  if (!titre) return;

  ajouterEvenement(titre, el.champDebut.value, el.champFin.value);
  fermerFormulaire();
  afficherGrille();
  afficherPanneau();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "F11") {
    e.preventDefault();
    basculerPleinEcran();
    return;
  }
  if (e.key === "Escape" && !el.formulaire.hidden) fermerFormulaire();
});

document.querySelectorAll("[data-theme-choix]").forEach((bouton) => {
  bouton.addEventListener("click", () => appliquerTheme(bouton.dataset.themeChoix));
});

// ---------- Démarrage ----------
let themeInitial = "dark";
try {
  themeInitial = localStorage.getItem(CLE_THEME) ?? "dark";
} catch {
  // on reste en sombre
}
appliquerTheme(themeInitial);
afficher();

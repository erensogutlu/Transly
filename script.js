const VERITABANI_YOLU = "lang-db.json";

let DIL_VERITABANI = null;
let KELIME_INDEKSI = {}; // KELIME_INDEKSI[dil][kelime] -> kavramSatiri
let CUMLE_INDEKSI = {}; // CUMLE_INDEKSI[dil][normalizeEdilmisCumle] -> cumleSatiri

function cumleyiNormalizeEt(metin) {
	return metin.toLowerCase().trim().replace(/\s+/g, " ");
}
function harfBuyuklukEsle(kaynak, hedef) {
	if (!hedef) return hedef;
	if (kaynak === kaynak.toUpperCase()) return hedef.toUpperCase();
	if (kaynak[0] && kaynak[0] === kaynak[0].toUpperCase()) {
		return hedef.charAt(0).toUpperCase() + hedef.slice(1);
	}
	return hedef;
}

// unicode kelime yakalayıcı (tr/ab dilleri)
const KELIME_REGEX = /\p{L}[\p{L}\p{M}'’-]*/gu;

// indeks oluşturma
function indeksleriOlustur(vt) {
	KELIME_INDEKSI = {};
	CUMLE_INDEKSI = {};
	const diller = vt.languages;

	// kelime indeksi
	for (const kavramSatiri of vt.lexicon) {
		for (const dil of diller) {
			const kelime = kavramSatiri[dil];
			if (!kelime) continue;
			(KELIME_INDEKSI[dil] ||= {})[kelime.toLowerCase()] = kavramSatiri;
		}
	}
	// cümle indeksi
	for (const cumleSatiri of vt.sentences) {
		for (const dil of diller) {
			const cumle = cumleSatiri[dil];
			if (!cumle) continue;
			(CUMLE_INDEKSI[dil] ||= {})[cumleyiNormalizeEt(cumle)] = cumleSatiri;
		}
	}
}

metniTemizle();

// çeviri motoru
function cumledenCevir(kaynakDil, hedefDil, metin) {
	const eslesme = CUMLE_INDEKSI[kaynakDil]?.[cumleyiNormalizeEt(metin)];
	return eslesme ? eslesme[hedefDil] || null : null;
}
function kelimeKelimeCevir(kaynakDil, hedefDil, metin) {
	if (!KELIME_INDEKSI[kaynakDil]) return metin;
	return metin.replace(KELIME_REGEX, (orijinal) => {
		const kavram = KELIME_INDEKSI[kaynakDil][orijinal.toLowerCase()];
		if (!kavram) return orijinal;
		const hedef = kavram[hedefDil] || orijinal;
		return harfBuyuklukEsle(orijinal, hedef);
	});
}

// uı fonksiyonları
function satirBasinaGel(el, evt) {
	// Fare tıklamasında caret'i olduğu yerde bırak
	if (
		evt &&
		(evt.type === "click" ||
			evt.type === "mousedown" ||
			evt.type === "pointerdown")
	)
		return;

	// odakta satır başına al
	try {
		el.focus({ preventScroll: true });
	} catch (_) {
		el.focus();
	}

	const val = el.value ?? "";
	const pos = typeof el.selectionStart === "number" ? el.selectionStart : 0;
	const prevNL = val.lastIndexOf("\n", Math.max(0, pos - 1));
	const lineStart = prevNL === -1 ? 0 : prevNL + 1;

	if (typeof el.setSelectionRange === "function") {
		const st = el.scrollTop,
			sl = el.scrollLeft; // kaydırmayı koru
		el.setSelectionRange(lineStart, lineStart);
		el.scrollTop = st;
		el.scrollLeft = sl;
	}
}

function metniCevir() {
	const girisEl = document.getElementById("giris-metni");
	const cikisEl = document.getElementById("cikis-metni");
	const sayacEl = document.getElementById("karakter-sayisi");

	const metin = girisEl.value;
	sayacEl.textContent = `${metin.length} / 5000`;

	if (!metin.trim()) {
		// boşken .cikisMetni:empty::before placeholder’ı görünsün
		cikisEl.textContent = "";
		return;
	}

	const kaynak = document.getElementById("kaynak-dil").value;
	const hedef = document.getElementById("hedef-dil").value;

	if (kaynak === hedef || !DIL_VERITABANI) {
		cikisEl.textContent = metin;
		return;
	}

	// tam cümle
	const cumleCevrimi = cumledenCevir(kaynak, hedef, metin);
	if (cumleCevrimi) {
		cikisEl.textContent = cumleCevrimi;
		return;
	}

	// kelime kelime
	const kelimeDuzeyiCevrim = kelimeKelimeCevir(kaynak, hedef, metin);
	cikisEl.textContent = kelimeDuzeyiCevrim;
}

function dilleriDegistir() {
	const kaynakDil = document.getElementById("kaynak-dil");
	const hedefDil = document.getElementById("hedef-dil");
	const girisEl = document.getElementById("giris-metni");
	const cikisEl = document.getElementById("cikis-metni");
	const sayacEl = document.getElementById("karakter-sayisi");

	// dilleri değiştir
	[kaynakDil.value, hedefDil.value] = [hedefDil.value, kaynakDil.value];

	// metinleri değiştir
	const eskiGiris = girisEl.value;
	const eskiCikis = cikisEl.textContent;

	girisEl.value = eskiCikis && eskiCikis.trim().length ? eskiCikis : eskiGiris;
	cikisEl.textContent = ""; // placeholder görünsün

	sayacEl.textContent = `${girisEl.value.length} / 5000`;
	try {
		girisEl.focus({ preventScroll: true });
		girisEl.setSelectionRange(girisEl.value.length, girisEl.value.length);
	} catch (_) {}

	// yeni çeviri üret
	metniCevir();
}

function metniTemizle() {
	document.getElementById("giris-metni").value = "";
	document.getElementById("cikis-metni").textContent = ""; // placeholder görünsün
	document.getElementById("karakter-sayisi").textContent = "0 / 5000";
}

// veritabanını yükle
async function veritabaniYukle() {
	try {
		const yanit = await fetch(VERITABANI_YOLU, { cache: "no-store" });
		if (!yanit.ok) throw new Error(yanit.status + " " + yanit.statusText);
		DIL_VERITABANI = await yanit.json();
		indeksleriOlustur(DIL_VERITABANI);
		metniCevir(); // sayfada metin varsa güncelle
	} catch (hata) {
		console.error("Veritabanı yüklenemedi:", hata);
		// db yoksa ui yine de çalışır (metni aynen gösterir)
	}
}

document.addEventListener("DOMContentLoaded", () => {
	veritabaniYukle();
	document.getElementById("kaynak-dil").addEventListener("change", metniCevir);
	document.getElementById("hedef-dil").addEventListener("change", metniCevir);
});

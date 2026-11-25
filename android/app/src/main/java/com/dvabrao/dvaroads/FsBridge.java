package com.dvabrao.dvaroads;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

/**
 * DVA Roads — ponte de arquivos (window.NativeFS).
 *
 * Todas as sessões ficam em:
 *   Android/data/com.dvabrao.dvaroads/files/DVA Roads/
 * Caminhos recebidos do JS são sempre relativos a essa pasta e não podem conter "..".
 * Backups (.zip) e exportações copiadas vão para Downloads/DVA Roads/ (visível no celular).
 */
public class FsBridge {

    private final Activity act;
    private final File root;

    public FsBridge(Activity act) {
        this.act = act;
        File base = act.getExternalFilesDir(null);
        if (base == null) base = act.getFilesDir();
        this.root = new File(base, "DVA Roads");
        //noinspection ResultOfMethodCallIgnored
        this.root.mkdirs();
    }

    private File resolve(String rel) throws Exception {
        if (rel == null) rel = "";
        rel = rel.replace('\\', '/');
        if (rel.contains("..")) throw new Exception("caminho inválido");
        while (rel.startsWith("/")) rel = rel.substring(1);
        return rel.isEmpty() ? root : new File(root, rel);
    }

    private static byte[] readAll(InputStream in) throws Exception {
        java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
        return bo.toByteArray();
    }

    private static void writeBytes(File f, byte[] data, boolean append) throws Exception {
        File p = f.getParentFile();
        if (p != null) //noinspection ResultOfMethodCallIgnored
            p.mkdirs();
        // grava em arquivo temporário e renomeia: evita arquivo corrompido se o app fechar no meio
        if (append) {
            try (FileOutputStream fo = new FileOutputStream(f, true)) { fo.write(data); }
            return;
        }
        File tmp = new File(f.getPath() + ".tmp");
        try (FileOutputStream fo = new FileOutputStream(tmp)) { fo.write(data); fo.getFD().sync(); }
        if (f.exists()) //noinspection ResultOfMethodCallIgnored
            f.delete();
        if (!tmp.renameTo(f)) throw new Exception("não foi possível gravar " + f.getName());
    }

    // ── Leitura e escrita ──────────────────────────────────────────

    @JavascriptInterface
    public String basePath() { return root.getAbsolutePath(); }

    @JavascriptInterface
    public boolean writeText(String rel, String text) {
        try { writeBytes(resolve(rel), text.getBytes(StandardCharsets.UTF_8), false); return true; }
        catch (Exception e) { android.util.Log.e("NativeFS", "writeText " + rel, e); return false; }
    }

    @JavascriptInterface
    public boolean appendText(String rel, String text) {
        try { writeBytes(resolve(rel), text.getBytes(StandardCharsets.UTF_8), true); return true; }
        catch (Exception e) { android.util.Log.e("NativeFS", "appendText " + rel, e); return false; }
    }

    @JavascriptInterface
    public String readText(String rel) {
        try {
            File f = resolve(rel);
            if (!f.exists()) return null;
            try (FileInputStream in = new FileInputStream(f)) { return new String(readAll(in), StandardCharsets.UTF_8); }
        } catch (Exception e) { return null; }
    }

    @JavascriptInterface
    public boolean writeBase64(String rel, String b64) {
        try { writeBytes(resolve(rel), Base64.decode(b64, Base64.DEFAULT), false); return true; }
        catch (Exception e) { android.util.Log.e("NativeFS", "writeBase64 " + rel, e); return false; }
    }

    @JavascriptInterface
    public String readBase64(String rel) {
        try {
            File f = resolve(rel);
            if (!f.exists()) return null;
            try (FileInputStream in = new FileInputStream(f)) { return Base64.encodeToString(readAll(in), Base64.NO_WRAP); }
        } catch (Exception e) { return null; }
    }

    @JavascriptInterface
    public boolean exists(String rel) {
        try { return resolve(rel).exists(); } catch (Exception e) { return false; }
    }

    /** Lista uma pasta: JSON [{name, dir, size, mtime}] */
    @JavascriptInterface
    public String list(String rel) {
        JSONArray arr = new JSONArray();
        try {
            File d = resolve(rel);
            File[] fs = d.listFiles();
            if (fs != null) for (File f : fs) {
                JSONObject o = new JSONObject();
                o.put("name", f.getName());
                o.put("dir", f.isDirectory());
                o.put("size", f.length());
                o.put("mtime", f.lastModified());
                arr.put(o);
            }
        } catch (Exception ignored) { }
        return arr.toString();
    }

    @JavascriptInterface
    public boolean remove(String rel) {
        try {
            File f = resolve(rel);
            if (f.equals(root)) return false; // nunca apaga a raiz
            return deleteRec(f);
        } catch (Exception e) { return false; }
    }

    private static boolean deleteRec(File f) {
        if (f.isDirectory()) {
            File[] fs = f.listFiles();
            if (fs != null) for (File c : fs) deleteRec(c);
        }
        return f.delete();
    }

    // ── Compartilhar e copiar para Downloads ──────────────────────────

    @JavascriptInterface
    public void shareFile(final String rel, final String mime) {
        act.runOnUiThread(() -> {
            try {
                File f = resolve(rel);
                // copia para o cache para usar o mesmo FileProvider já testado
                File dir = new File(act.getCacheDir(), "share");
                //noinspection ResultOfMethodCallIgnored
                dir.mkdirs();
                File out = new File(dir, f.getName());
                try (FileInputStream in = new FileInputStream(f)) { writeBytes(out, readAll(in), false); }
                Uri uri = FileProvider.getUriForFile(act, act.getPackageName() + ".fileprovider", out);
                Intent share = new Intent(Intent.ACTION_SEND);
                share.setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                share.putExtra(Intent.EXTRA_STREAM, uri);
                share.putExtra(Intent.EXTRA_SUBJECT, f.getName());
                share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                act.startActivity(Intent.createChooser(share, "Enviar " + f.getName()));
            } catch (Exception e) {
                android.util.Log.e("NativeFS", "shareFile " + rel, e);
            }
        });
    }

    /** Copia um arquivo da pasta do app para Downloads/DVA Roads/<sub>/ . Retorna o caminho visível. */
    @JavascriptInterface
    public String copyToDownloads(String rel, String sub) {
        try {
            File f = resolve(rel);
            byte[] data;
            try (FileInputStream in = new FileInputStream(f)) { data = readAll(in); }
            return saveToDownloads(f.getName(), sub, data);
        } catch (Exception e) {
            android.util.Log.e("NativeFS", "copyToDownloads " + rel, e);
            return null;
        }
    }

    private String saveToDownloads(String name, String sub, byte[] data) throws Exception {
        String folder = "DVA Roads" + (sub == null || sub.isEmpty() ? "" : "/" + sub);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues v = new ContentValues();
            v.put(MediaStore.Downloads.DISPLAY_NAME, name);
            v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + folder);
            v.put(MediaStore.Downloads.IS_PENDING, 1);
            Uri uri = act.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (uri == null) throw new Exception("MediaStore recusou");
            try (OutputStream os = act.getContentResolver().openOutputStream(uri)) {
                if (os != null) os.write(data);
            }
            v.clear();
            v.put(MediaStore.Downloads.IS_PENDING, 0);
            act.getContentResolver().update(uri, v, null, null);
        } else {
            File d = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), folder);
            //noinspection ResultOfMethodCallIgnored
            d.mkdirs();
            writeBytes(new File(d, name), data, false);
        }
        return "Downloads/" + folder + "/" + name;
    }

    // ── Backup (.zip) ────────────────────────────────────────────────

    /**
     * Compacta uma pasta (ex.: "Sessoes/2026-11-25_SH_001") em <zipName> dentro de "Backup/"
     * e copia para Downloads/DVA Roads/Backup. Retorna JSON {rel, visivel} ou null.
     */
    @JavascriptInterface
    public String zipDir(String relDir, String zipName) {
        try {
            File src = resolve(relDir);
            File out = resolve("Backup/" + zipName);
            File p = out.getParentFile();
            if (p != null) //noinspection ResultOfMethodCallIgnored
                p.mkdirs();
            try (ZipOutputStream zo = new ZipOutputStream(new FileOutputStream(out))) {
                addToZip(zo, src, src.getName());
            }
            byte[] data;
            try (FileInputStream in = new FileInputStream(out)) { data = readAll(in); }
            String vis = saveToDownloads(zipName, "Backup", data);
            JSONObject o = new JSONObject();
            o.put("rel", "Backup/" + zipName);
            o.put("visivel", vis);
            return o.toString();
        } catch (Exception e) {
            android.util.Log.e("NativeFS", "zipDir " + relDir, e);
            return null;
        }
    }

    private void addToZip(ZipOutputStream zo, File f, String name) throws Exception {
        if (f.isDirectory()) {
            File[] fs = f.listFiles();
            if (fs != null) for (File c : fs) addToZip(zo, c, name + "/" + c.getName());
            return;
        }
        if (f.getName().endsWith(".tmp")) return;
        zo.putNextEntry(new ZipEntry(name));
        try (FileInputStream in = new FileInputStream(f)) {
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) zo.write(buf, 0, n);
        }
        zo.closeEntry();
    }

    /** Restaura um .zip (base64) para dentro de "Sessoes/". Retorna o nome da pasta restaurada. */
    @JavascriptInterface
    public String unzipToSessions(String b64) {
        try {
            byte[] data = Base64.decode(b64, Base64.DEFAULT);
            String first = null;
            try (ZipInputStream zi = new ZipInputStream(new java.io.ByteArrayInputStream(data))) {
                ZipEntry e;
                while ((e = zi.getNextEntry()) != null) {
                    String n = e.getName().replace('\\', '/');
                    if (n.contains("..")) continue;
                    if (first == null) first = n.split("/")[0];
                    File f = resolve("Sessoes/" + n);
                    if (e.isDirectory()) { //noinspection ResultOfMethodCallIgnored
                        f.mkdirs(); continue; }
                    writeBytes(f, readAll(zi), false);
                }
            }
            return first;
        } catch (Exception e) {
            android.util.Log.e("NativeFS", "unzip", e);
            return null;
        }
    }
}

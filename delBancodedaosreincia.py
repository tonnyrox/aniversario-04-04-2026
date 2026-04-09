# -*- coding: utf-8 -*-
import subprocess, time, os, sys, sqlite3, json, datetime
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except:
        pass

PASTA_APP = Path(__file__).parent.resolve() / "anivapp"
PORTA     = 3000
SEP       = "=" * 60

def msg(t):  print(f"\n> {t}")
def ok(t):   print(f"  [OK] {t}")
def erro(t): print(f"  [!!] {t}")

def mata_porta(porta):
    msg(f"Fechando processo Node.js na porta {porta}...")
    try:
        resultado = subprocess.check_output(f'netstat -ano | findstr :{porta}', shell=True, text=True)
        pids = set()
        for linha in resultado.strip().split('\n'):
            partes = linha.split()
            if partes:
                pid = partes[-1]
                if pid != '0':
                    pids.add(pid)
        for pid in pids:
            subprocess.run(f'taskkill /PID {pid} /F', shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            ok(f"Processo {pid} finalizado.")
    except subprocess.CalledProcessError:
        ok("Nenhum processo encontrado na porta. Seguindo...")

def deletar_banco():
    db_file = PASTA_APP / "dados.db"
    msg("Deletando banco de dados — sem deixar rastro...")

    # Apaga QUALQUER arquivo que contenha "dados.db" no nome (inclusive temporários, cópias, etc.)
    timeout = 5
    start = time.time()
    deleted = False

    while time.time() - start < timeout:
        # Apaga dados.db PRIMEIRO, depois os auxiliares
        ordem = [
            PASTA_APP / "dados.db",
            PASTA_APP / "dados.db-shm",
            PASTA_APP / "dados.db-wal",
        ]
        for f in ordem:
            if f.exists():
                try:
                    f.unlink()
                    print(f"  [+] Removido: {f.name}")
                except:
                    pass

        # Garante que nenhum vestígio restou (pega cópias/temporários extras)
        for f in list(PASTA_APP.iterdir()):
            if "dados.db" in f.name:
                try:
                    f.unlink()
                    print(f"  [+] Removido extra: {f.name}")
                except:
                    pass

        # Confirma que nenhum vestígio restou
        restos = [f for f in PASTA_APP.iterdir() if "dados.db" in f.name]
        if not restos:
            deleted = True
            break

        print("  [!] Arquivo ainda em uso, aguardando...")
        time.sleep(0.5)

    if not deleted:
        restos = [f.name for f in PASTA_APP.iterdir() if "dados.db" in f.name]
        erro(f"NAO FOI POSSIVEL DELETAR! Arquivos restantes: {restos}")
        sys.exit(1)

    ok("Banco deletado — nenhum vestígio restou!")

    msg("Criando banco novo...")
    try:
        conn = sqlite3.connect(str(db_file))
        cur = conn.cursor()
        cur.executescript("""
            CREATE TABLE IF NOT EXISTS clientes (
              usuario TEXT PRIMARY KEY, master TEXT, negocio TEXT, sugestao TEXT, nome TEXT, nasc TEXT,
              telefone TEXT, email TEXT, senha_hash TEXT, cep TEXT, rua TEXT, num TEXT, comp TEXT,
              bairro TEXT, cidade TEXT, uf TEXT, status TEXT DEFAULT 'ativo', perfil_id TEXT,
              oferta_enviada INTEGER DEFAULT 0, enviado_em TEXT, criado_em TEXT
            );
            CREATE TABLE IF NOT EXISTS empresas (
              negocio TEXT PRIMARY KEY, master TEXT, usuario TEXT DEFAULT '', is_sugestao INTEGER DEFAULT 0,
              indicado_por TEXT, empresa TEXT, segmento TEXT, telefone TEXT, email TEXT, ig TEXT,
              site TEXT, cardapio TEXT, rua TEXT, num TEXT, comp TEXT, bairro TEXT, cep TEXT, cidade TEXT, uf TEXT,
              lat REAL, lng REAL, obs TEXT, oferta_tipo TEXT, oferta_valida TEXT, oferta_destaque TEXT,
              oferta_detalhe TEXT, oferta_regras TEXT, hh_desc TEXT, horarios TEXT,
              estacionamento INTEGER DEFAULT 0, brinquedoteca INTEGER DEFAULT 0,
              comida_vegana INTEGER DEFAULT 0, cadeirinha INTEGER DEFAULT 0, delivery INTEGER DEFAULT 0,
              status TEXT DEFAULT '01', status_perfil TEXT DEFAULT 'comunidade',
              aprovado_em TEXT, atualizado_em TEXT, criado_em TEXT
            );
        """)
        conn.commit()
        conn.close()
        ok("Banco novo criado e populado!")
    except Exception as e:
        erro(f"Erro ao criar banco: {e}")
        sys.exit(1)

def start_node():
    msg("Iniciando servidor Node.js...")
    print(f"""
{SEP}
  Launcher : http://localhost:{PORTA}/launcher
  Admin    : http://localhost:{PORTA}/admin
  Perfil   : http://localhost:{PORTA}/perfil
  Acesso   : http://localhost:{PORTA}/acesso
{SEP}
  Pressione Ctrl+C para encerrar o servidor.
{SEP}
""")
    try:
        os.chdir(str(PASTA_APP))
        subprocess.run(["node", "server.js"], shell=(sys.platform == "win32"))
    except KeyboardInterrupt:
        print("\n\nServidor encerrado.")

if __name__ == "__main__":
    try:
        os.system('cls' if os.name == 'nt' else 'clear')
        print(f"{SEP}\n   ANIVAPP — DELETAR BANCO E INICIAR\n{SEP}")

        mata_porta(PORTA)
        time.sleep(1)
        deletar_banco()

        msg("Tudo pronto!")
        start_node()

    except KeyboardInterrupt:
        print("\n\nEncerrado pelo usuario.")
    except Exception as e:
        erro(f"Erro fatal: {e}")
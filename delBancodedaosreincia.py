import subprocess, time, os, sys

PASTA = r"E:\aniversario-programa\anivapp"
PORT  = 3000

os.chdir(PASTA)
print("=" * 50)
print("   AnivCRM — Iniciador")
print("=" * 50)
print(f"📁 Pasta : {PASTA}")

# 1. Matar node
print("\n💀 Matando node.exe...")
subprocess.run("taskkill /IM node.exe /F", shell=True, capture_output=True)
time.sleep(2)

# 2. Deletar banco
print("🔓 Forçando desbloqueio do banco...")
for arq in ["dados.db", "dados.db-shm", "dados.db-wal"]:
    caminho = os.path.join(PASTA, arq)
    if not os.path.exists(caminho):
        print(f"   ⚠️  {arq} não encontrado (ok)")
        continue
    subprocess.run(f'cmd /c del /f /q "{caminho}"', shell=True, capture_output=True)
    if not os.path.exists(caminho):
        print(f"   🗑️  {arq} deletado!")
    else:
        try:
            tmp = caminho + ".old"
            os.rename(caminho, tmp)
            os.remove(tmp)
            print(f"   🗑️  {arq} deletado (via rename)!")
        except Exception as e:
            print(f"   ❌ Não conseguiu deletar {arq}: {e}")
            sys.exit(1)

# 3. Inicia servidor silenciosamente (suprime output do Node)
print("\n🚀 Iniciando servidor...\n")
proc = subprocess.Popen(
    "npm start",
    shell=True,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL
)

# 4. Aguarda servidor subir e mostra links UMA única vez
time.sleep(3)
print("=" * 50)
print(f"  ✅ Servidor rodando na porta {PORT}\n")
print(f"  🔑 Login:          http://localhost:{PORT}/acessos.html")
print(f"  🌐 App (Perfil):   http://localhost:{PORT}")
print(f"  ⚙️  Admin:          http://localhost:{PORT}/admin")
print(f"  🚀 Launcher (Dev): http://localhost:{PORT}/launcher")
print("=" * 50)
print("\n  Ctrl+C para parar o servidor.\n")

# 5. Mantém o script vivo enquanto o Node roda
try:
    proc.wait()
except KeyboardInterrupt:
    print("\n🛑 Encerrando servidor...")
    proc.terminate()
    sys.exit(0)
import os
import subprocess

# 1. Define a pasta do projeto
pasta_projeto = r"E:\aniversario-programa\anivapp"

print("===================================================")
print("       REINICIANDO SERVIDOR ANIVAPP (PYTHON)")
print("===================================================\n")

# Muda para a pasta do projeto
try:
    os.chdir(pasta_projeto)
    print(f"[1] Acessando a pasta: {pasta_projeto}")
except FileNotFoundError:
    print(f"Erro: A pasta {pasta_projeto} não foi encontrada.")
    exit()

# 2. Verifica se a porta 3000 está em uso, mostra e fecha
print("\n[2] Verificando se a porta 3000 esta em uso...")
try:
    # Roda o comando netstat para achar quem está usando a porta 3000
    resultado = subprocess.check_output('netstat -ano | findstr :3000', shell=True, text=True)
    linhas = resultado.strip().split('\n')
    
    print("    -> Processos encontrados na porta 3000:")
    
    pids_fechados = []
    for linha in linhas:
        print(f"       {linha.strip()}") # Mostra o processo na tela para você ver
        
        partes = linha.split()
        pid = partes[-1] # O PID é o último número da linha
        
        # Se achou um PID válido e ainda não fechou ele
        if pid != '0' and pid not in pids_fechados:
            print(f"    -> Fechando processo (PID: {pid})...")
            subprocess.run(f'taskkill /PID {pid} /F', shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            pids_fechados.append(pid)
            
except subprocess.CalledProcessError:
    print("    -> Nenhum servidor rodando na porta 3000. A porta esta livre!")

# 3. Inicia o Node.js
print("\n[3] Iniciando o Node.js (npm start)...")
print("===================================================")
try:
    # Executa o npm start e mantém o terminal rodando
    subprocess.run('npm start', shell=True)
except KeyboardInterrupt:
    print("\nServidor encerrado pelo usuário.")
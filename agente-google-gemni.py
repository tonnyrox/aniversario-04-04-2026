import os
import json
import subprocess
import sys
import shutil

def encontrar_vscode():
    code_cmd = shutil.which("code")
    if not code_cmd:
        possiveis = [
            os.path.expandvars(r"%LOCALAPPDATA%\Programs\Microsoft VS Code\bin\code.cmd"),
            r"C:\Program Files\Microsoft VS Code\bin\code.cmd",
        ]
        for p in possiveis:
            if os.path.exists(p):
                return p
    return code_cmd

def instalar_continue(code_cmd):
    print("[1/3] Instalando Continue...")
    subprocess.run(
        [code_cmd, "--install-extension", "Continue.continue", "--force"],
        capture_output=True, text=True, shell=True
    )
    print("✅ Continue instalado!")

def configurar_api(api_key):
    print("[2/3] Configurando Gemini...")
    config_dir = os.path.join(os.environ["USERPROFILE"], ".continue")
    config_path = os.path.join(config_dir, "config.json")
    os.makedirs(config_dir, exist_ok=True)

    config = {
        "models": [
            {
                "title": "Gemini Pro",
                "provider": "google",
                "model": "gemini-1.5-pro",
                "apiKey": api_key
            }
        ],
        "tabAutocompleteModel": {
            "title": "Gemini Flash",
            "provider": "google",
            "model": "gemini-1.5-flash",
            "apiKey": api_key
        },
        "contextProviders": [
            {"name": "code"},
            {"name": "docs"},
            {"name": "diff"},
            {"name": "terminal"},
            {"name": "problems"},
            {"name": "folder"},
            {"name": "codebase"}
        ],
        "slashCommands": [
            {"name": "edit", "description": "Editar código"},
            {"name": "comment", "description": "Comentar código"},
            {"name": "cmd", "description": "Gerar comando"}
        ]
    }

    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    print("✅ Gemini configurado!")

def abrir_chat_continue(code_cmd):
    """Abre o chat do Continue no VS Code já aberto via --command (sem nova janela)"""
    print("[3/3] Abrindo chat do Continue...")
    subprocess.Popen(
        [code_cmd, "--command", "continue.focusContinueInput"],
        shell=True
    )
    print("✅ Chat do Continue aberto!")

def main():
    print("╔══════════════════════════════════════════════╗")
    print("║   Continue + Gemini — Setup Rápido           ║")
    print("╚══════════════════════════════════════════════╝\n")

    api_key = input("Cole sua API Key e pressione Enter:\n> ").strip()

    if not api_key:
        print("❌ Chave não informada.")
        sys.exit(1)

    code_cmd = encontrar_vscode()
    if not code_cmd:
        print("❌ VS Code não encontrado!")
        sys.exit(1)

    instalar_continue(code_cmd)
    configurar_api(api_key)
    abrir_chat_continue(code_cmd)

    print("\n╔══════════════════════════════════════════════╗")
    print("║  ✅ PRONTO! Chat abrindo no VS Code...       ║")
    print("║                                              ║")
    print("║  Escreva no chat, ex:                        ║")
    print("║  @codebase explica esse projeto              ║")
    print("╚══════════════════════════════════════════════╝")

if __name__ == "__main__":
    main()
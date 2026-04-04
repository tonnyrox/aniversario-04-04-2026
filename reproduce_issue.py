import http.client
import json

def test_delete():
    conn = http.client.HTTPConnection("localhost", 3000)
    
    # 1. Get all clients
    print("Fetching clients...")
    conn.request("GET", "/api/clientes")
    res = conn.getresponse()
    if res.status != 200:
        print(f"Error fetching: {res.status}")
        return
    
    clients = json.loads(res.read().decode())
    if not clients:
        print("No clients found to delete.")
        return
    
    # 2. Try to delete the first one
    target = clients[0]
    print(f"Attempting delete: {target['nome']} (ID: {target['id']})")
    
    conn.request("DELETE", f"/api/clientes/{target['id']}")
    del_res = conn.getresponse()
    print(f"Status: {del_res.status}")
    print(f"Response: {del_res.read().decode()}")

if __name__ == "__main__":
    test_delete()

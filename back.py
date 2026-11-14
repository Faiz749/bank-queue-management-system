import time
from math import ceil
from collections import deque

# --- Flask Imports ---
# You must install Flask first!
# In your terminal, run: pip install Flask flask-cors
from flask import Flask, request, jsonify
from flask_cors import CORS

# --- Your Existing Classes (No changes needed here) ---

class LoginManager:
    def __init__(self):
        self.user_password_map = {"admin12": "9876"}

    def signup(self, user_name, password, password_confirm):
        if not user_name or not password:
            return False, "Username or password cannot be empty."
        if user_name in self.user_password_map:
            return False, "That username already exists."
        if password != password_confirm:
            return False, "Passwords do not match."
        
        self.user_password_map[user_name] = password
        return True, "Signup successful."

    def user_login(self, user_name, password):
        stored_password = self.user_password_map.get(user_name)
        if stored_password == password and user_name != "admin12":
            return True, "Login successful."
        return False, "Wrong username or password."

    def admin_login(self, admin_name, admin_password):
        if admin_name == "admin12" and admin_password == "9876":
            return True, "Admin login successful."
        return False, "Wrong admin credentials."


class ServiceQueue:
    def __init__(self):
        self.waiting_queue = deque()
        self.next_ticket_number = 1

    def add_ticket(self, customer_name, service_name, priority_level=1):
        arrival_time = time.time()
        ticket = {
            "ticket_number": self.next_ticket_number,
            "customer_name": customer_name,
            "service_name": service_name,
            "priority_level": priority_level,
            "arrival_time": arrival_time
        }
        self.waiting_queue.append(ticket)
        # Sort the queue by priority (desc) and then arrival time (asc)
        self.sort_queue()
        self.next_ticket_number += 1
        return ticket

    def list_waiting(self):
        return list(self.waiting_queue)

    def sort_queue(self):
        # Sort by priority (higher number first), then by arrival time (lower number first)
        self.waiting_queue = deque(sorted(
            self.waiting_queue, 
            key=lambda t: (-t["priority_level"], t["arrival_time"])
        ))

    def change_ticket_priority(self, ticket_number, new_priority_level):
        found = False
        for ticket in self.waiting_queue:
            if ticket["ticket_number"] == ticket_number:
                ticket["priority_level"] = new_priority_level
                found = True
                break
        if found:
            self.sort_queue() # Re-sort the queue after priority change
            return True, "Priority updated."
        return False, "Ticket not found."

    def serve_next_ticket(self):
        if self.waiting_queue:
            return self.waiting_queue.popleft()
        return None


class TicketHistory:
    def __init__(self):
        self.completed_records = []

    def add_record(self, ticket, service_start_time, service_end_time, counter_identifier):
        record = {
            "ticket_number": ticket["ticket_number"],
            "customer_name": ticket["customer_name"],
            "service_name": ticket["service_name"],
            "arrival_time": ticket["arrival_time"],
            "service_start_time": service_start_time,
            "service_end_time": service_end_time,
            "total_wait_time": service_end_time - ticket["arrival_time"],
            "counter_identifier": counter_identifier
        }
        self.completed_records.append(record)
        return record

    def get_all_records(self):
        return list(self.completed_records)


class MetricsEngine:
    def __init__(self, history_store: TicketHistory):
        self.history_store = history_store

    def get_metrics(self):
        records = self.history_store.get_all_records()
        if not records:
            return {"avg": 0.0, "p90": 0.0, "served": 0}
            
        waits = sorted(float(r.get("total_wait_time", 0.0)) for r in records)
        total = sum(waits)
        count = len(waits)
        avg = total / count
        
        index = max(0, min(count - 1, ceil(0.9 * count) - 1))
        p90 = waits[index]
        
        return {"avg": avg, "p90": p90, "served": count}


class CustomerAccountManager:
    def __init__(self):
        self.customer_accounts = {}

    def get_account(self, user_name):
        return self.customer_accounts.get(user_name)

    def create_account_for_user(self, user_name, full_name, id_number):
        if user_name in self.customer_accounts:
            return False, "Account already exists for this user."
        if not full_name or not id_number:
            return False, "Name and ID cannot be empty."
            
        self.customer_accounts[user_name] = {
            "full_name": full_name,
            "id_number": id_number,
            "balance": 0.0
        }
        return True, "Account created."

    def deposit_or_withdraw_for_user(self, user_name, action, amount):
        if user_name not in self.customer_accounts:
            return False, "No account found for this user."
        try:
            amount = float(amount)
        except:
            return False, "Invalid amount."
            
        if amount <= 0:
            return False, "Amount must be positive."
            
        account = self.customer_accounts[user_name]
        
        if action == "deposit":
            account["balance"] += amount
            return True, f"Deposited {amount:.2f}. New balance: {account['balance']:.2f}"
        elif action == "withdraw":
            if account["balance"] >= amount:
                account["balance"] -= amount
                return True, f"Withdrew {amount:.2f}. New balance: {account['balance']:.2f}"
            else:
                return False, "Insufficient funds."
        else:
            return False, "Invalid action."

    def pay_bill_for_user(self, user_name, bill_identifier, amount):
        if user_name not in self.customer_accounts:
            return False, "No account found for this user."
        try:
            amount = float(amount)
        except:
            return False, "Invalid amount."
        if amount <= 0:
            return False, "Amount must be positive."
            
        account = self.customer_accounts[user_name]
        if account["balance"] >= amount:
            account["balance"] -= amount
            return True, f"Paid bill {bill_identifier} of ${amount:.2f}. New balance: {account['balance']:.2f}"
        else:
            return False, "Insufficient funds."

    def apply_for_loan_for_user(self, user_name, amount):
        if user_name not in self.customer_accounts:
            return False, "No account found for this user."
        try:
            amount = float(amount)
        except:
            return False, "Invalid amount."
        if amount <= 0:
            return False, "Loan amount must be positive."
        
        # Loan is not an immediate action
        return True, f"Loan application for ${amount:.2f} submitted for review."

# --- API Server Setup ---

app = Flask(__name__)
# CORS(app) allows your React frontend (on a different port) to talk to this server
CORS(app) 

# Create single instances of all your managers
service_queue = ServiceQueue()
ticket_history = TicketHistory()
metrics_engine = MetricsEngine(ticket_history)
login_manager = LoginManager()
account_manager = CustomerAccountManager()

# --- API Routes ---

@app.route('/api/signup', methods=['POST'])
def api_signup():
    data = request.get_json()
    user_name = data.get('username')
    password = data.get('password')
    password_confirm = data.get('confirm')
    
    success, message = login_manager.signup(user_name, password, password_confirm)
    
    if success:
        return jsonify({"success": True, "message": message})
    else:
        return jsonify({"success": False, "message": message}), 400

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    user_name = data.get('username')
    password = data.get('password')

    # Check admin login
    is_admin, admin_msg = login_manager.admin_login(user_name, password)
    if is_admin:
        return jsonify({"success": True, "role": "admin", "message": admin_msg})

    # Check user login
    is_user, user_msg = login_manager.user_login(user_name, password)
    if is_user:
        return jsonify({"success": True, "role": "customer", "message": user_msg})
        
    return jsonify({"success": False, "message": "Wrong username or password."}), 401

# --- Customer Routes ---

@app.route('/api/customer/account', methods=['GET'])
def api_get_account():
    # In a real app, you'd get username from a secure token.
    # For now, we'll pass it as a query parameter.
    user_name = request.args.get('username')
    if not user_name:
        return jsonify({"success": False, "message": "Username required."}), 400
        
    account = account_manager.get_account(user_name)
    if account:
        return jsonify({"success": True, "account": account})
    else:
        return jsonify({"success": False, "message": "No account found."}), 404

@app.route('/api/customer/create-account', methods=['POST'])
def api_create_account():
    data = request.get_json()
    user_name = data.get('username') # Again, username would come from a token
    full_name = data.get('fullName')
    id_number = data.get('idNumber')

    success, message = account_manager.create_account_for_user(user_name, full_name, id_number)
    
    if success:
        # Automatically add a ticket
        ticket = service_queue.add_ticket(user_name, "New Account", priority_level=1)
        return jsonify({"success": True, "message": message, "ticket": ticket})
    else:
        return jsonify({"success": False, "message": message}), 400

@app.route('/api/customer/request-service', methods=['POST'])
def api_request_service():
    data = request.get_json()
    user_name = data.get('username')
    service_name = data.get('serviceName')
    
    # Simple priority mapping
    priority = 2 # Default for requests
    if service_name == "New Account":
        priority = 1
        
    ticket = service_queue.add_ticket(user_name, service_name, priority_level=priority)
    return jsonify({"success": True, "message": f"Ticket created for {service_name}", "ticket": ticket})

# --- Admin Routes ---

@app.route('/api/admin/dashboard', methods=['GET'])
def api_admin_dashboard():
    metrics = metrics_engine.get_metrics()
    queue = service_queue.list_waiting()
    history = ticket_history.get_all_records()
    
    return jsonify({
        "success": True,
        "queue": queue,
        "history": history,
        "metrics": {
            "customersWaiting": len(queue),
            "avgWait": metrics['avg'],
            "p90Wait": metrics['p90'],
            "servedToday": metrics['served']
        }
    })

@app.route('/api/admin/serve-next', methods=['POST'])
def api_serve_next():
    ticket = service_queue.serve_next_ticket()
    if not ticket:
        return jsonify({"success": False, "message": "No customers in queue."}), 404
        
    service_start = time.time()
    # Simulate service time
    time.sleep(1) 
    service_end = time.time()
    
    # In a real app, counter ID would come from the admin's session
    counter_identifier = f"Counter {int(time.time() % 4 + 1)}" 
    
    record = ticket_history.add_record(ticket, service_start, service_end, counter_identifier)
    
    return jsonify({"success": True, "message": f"Served ticket #{ticket['ticket_number']}", "record": record})

@app.route('/api/admin/change-priority', methods=['POST'])
def api_change_priority():
    data = request.get_json()
    ticket_number = int(data.get('ticketNumber'))
    new_priority = int(data.get('priorityLevel'))
    
    success, message = service_queue.change_ticket_priority(ticket_number, new_priority)
    
    if success:
        return jsonify({"success": True, "message": message})
    else:
        return jsonify({"success": False, "message": message}), 404


# --- Run the Server ---
if __name__ == "__main__":
    # Add some demo data on startup (optional)
    demo_user = "john"
    login_manager.signup("john", "johnpass", "johnpass")
    account_manager.create_account_for_user(demo_user, "John Doe", "ID12345")
    account_manager.deposit_or_withdraw_for_user(demo_user, "deposit", 500)
    service_queue.add_ticket("jane", "Deposit/Withdraw", 2)
    service_queue.add_ticket("rob", "Loan Application", 3)
    
    print("Starting BankQueue API server at http://127.0.0.1:5000")
    app.run(debug=True, port=5000)
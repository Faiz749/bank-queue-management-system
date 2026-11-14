import React, { useEffect, useState } from "react";
import "./App.css";

// Point this to your Flask backend
const API_BASE = "http://127.0.0.1:5000/api";

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function formatWait(seconds) {
  if (seconds == null) return "-";
  const s = Number(seconds);
  if (Number.isNaN(s)) return "-";
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}m ${r}s`;
}

export default function App() {
  // Screens: login | customer | admin
  const [screen, setScreen] = useState("login");
  const [role, setRole] = useState("customer");
  const [currentUser, setCurrentUser] = useState(null);

  // login + signup
  const [loginInputs, setLoginInputs] = useState({ username: "", password: "" });
  const [signupInputs, setSignupInputs] = useState({
    username: "",
    password: "",
    confirm: "",
  });

  // customer state
  const [account, setAccount] = useState(null);
  const [accountForm, setAccountForm] = useState({ fullName: "", idNumber: "" });
  const [myTickets, setMyTickets] = useState([]); // only tickets created by this customer

  // admin state
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [metrics, setMetrics] = useState({
    customersWaiting: 0,
    avgWait: 0,
    p90Wait: 0,
    servedToday: 0,
  });
  const [priorityTicketNumber, setPriorityTicketNumber] = useState("");
  const [priorityLevel, setPriorityLevel] = useState(2);

  // ------------- API helpers -------------

  async function apiSignup(username, password, confirm) {
    const res = await fetch(`${API_BASE}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, confirm }),
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.message || "Signup failed");
    }
    return data;
  }

  async function apiLogin(username, password) {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.message || "Login failed");
    }
    return data;
  }

  async function apiGetAccount(username) {
    const res = await fetch(
      `${API_BASE}/customer/account?username=${encodeURIComponent(username)}`
    );
    const data = await res.json();
    if (!res.ok || data.success === false) {
      return null;
    }
    return data.account;
  }

  async function apiCreateAccount(username, fullName, idNumber) {
    const res = await fetch(`${API_BASE}/customer/create-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, fullName, idNumber }),
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.message || "Create account failed");
    }
    return data; // {success, message, ticket}
  }

  async function apiRequestService(username, serviceName) {
    const res = await fetch(`${API_BASE}/customer/request-service`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, serviceName }),
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.message || "Request service failed");
    }
    return data; // {success, message, ticket}
  }

  async function apiAdminDashboard() {
    const res = await fetch(`${API_BASE}/admin/dashboard`);
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.message || "Failed to load dashboard");
    }
    return data;
  }

  async function apiServeNext() {
    const res = await fetch(`${API_BASE}/admin/serve-next`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.message || "Serve next failed");
    }
    return data;
  }

  async function apiChangePriority(ticketNumber, priorityLevel) {
    const res = await fetch(`${API_BASE}/admin/change-priority`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketNumber, priorityLevel }),
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.message || "Change priority failed");
    }
    return data;
  }

  // ------------- Actions: Signup / Login / Logout -------------

  async function handleSignup() {
    const { username, password, confirm } = signupInputs;
    if (!username || !password || !confirm) {
      alert("Please fill all fields.");
      return;
    }
    if (password !== confirm) {
      alert("Passwords do not match.");
      return;
    }
    try {
      const data = await apiSignup(username, password, confirm);
      alert(data.message || "Signup successful. Please login.");
      setSignupInputs({ username: "", password: "", confirm: "" });
      setRole("customer");
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }

  async function handleLogin() {
    const { username, password } = loginInputs;
    if (!username || !password) {
      alert("Enter username & password.");
      return;
    }
    try {
      const data = await apiLogin(username, password);

      setCurrentUser(username);

      if (data.role === "admin") {
        setScreen("admin");
        await refreshAdminDashboard();
      } else {
        setScreen("customer");
        await refreshCustomerData(username);
      }

      setLoginInputs({ username: "", password: "" });
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }

  function handleLogout() {
    setCurrentUser(null);
    setScreen("login");
    setAccount(null);
    setMyTickets([]);
    setQueue([]);
    setHistory([]);
  }

  // ------------- Data refresh helpers -------------

  async function refreshCustomerData(username) {
    const acct = await apiGetAccount(username);
    setAccount(acct);
    // tickets are only known for what this customer created in this session
    // (backend doesn't have a "my tickets" route), so we leave myTickets as-is
  }

  async function refreshAdminDashboard() {
    try {
      const data = await apiAdminDashboard();
      setQueue(data.queue || []);
      setHistory(data.history || []);
      setMetrics(data.metrics || {
        customersWaiting: 0,
        avgWait: 0,
        p90Wait: 0,
        servedToday: 0,
      });
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }

  // ------------- Customer actions -------------

  async function createAccountForCurrentUser() {
    if (!currentUser) {
      alert("Login first.");
      return;
    }
    if (!accountForm.fullName || !accountForm.idNumber) {
      alert("Full name and ID number required.");
      return;
    }

    try {
      const data = await apiCreateAccount(
        currentUser,
        accountForm.fullName,
        accountForm.idNumber
      );

      alert(data.message || "Account created.");

      // refresh account info from backend
      const acct = await apiGetAccount(currentUser);
      setAccount(acct);

      // add the created ticket (if backend gave one)
      if (data.ticket) {
        setMyTickets((t) => [...t, data.ticket]);
      }

      setAccountForm({ fullName: "", idNumber: "" });
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }

  async function requestService(serviceName) {
    if (!currentUser) {
      alert("Login first.");
      return;
    }
    try {
      const data = await apiRequestService(currentUser, serviceName);
      alert(data.message || `Ticket created for ${serviceName}.`);
      if (data.ticket) {
        setMyTickets((t) => [...t, data.ticket]);
      }
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }

  // ------------- Admin actions -------------

  async function serveNextCustomer() {
    try {
      const data = await apiServeNext();
      alert(data.message || "Served next customer.");
      await refreshAdminDashboard();
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }

  async function changeTicketPriority() {
    const tnum = Number(priorityTicketNumber);
    if (!tnum) {
      alert("Enter a valid ticket number.");
      return;
    }
    try {
      await apiChangePriority(tnum, Number(priorityLevel));
      alert(`Updated priority for ticket #${tnum}.`);
      setPriorityTicketNumber("");
      await refreshAdminDashboard();
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }

  // ------------- RENDER SCREENS -------------

  // LOGIN SCREEN
  if (screen === "login") {
    return (
      <div className="app-root">
        <header className="topbar">
          <h1>BankQueue Pro</h1>
        </header>

        <main className="container card login-card">
          <div className="role-select">
            <button
              className={role === "customer" ? "chip active" : "chip"}
              onClick={() => setRole("customer")}
            >
              Customer
            </button>
            <button
              className={role === "admin" ? "chip active" : "chip"}
              onClick={() => setRole("admin")}
            >
              Admin
            </button>
          </div>

          <div className="form-group">
            <label>Username</label>
            <input
              value={loginInputs.username}
              onChange={(e) =>
                setLoginInputs((s) => ({ ...s, username: e.target.value }))
              }
              placeholder="username"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={loginInputs.password}
              onChange={(e) =>
                setLoginInputs((s) => ({ ...s, password: e.target.value }))
              }
              placeholder="password"
            />
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={handleLogin}>
              Login
            </button>
            <button
              className="btn-outline"
              onClick={() => {
                if (role === "admin") {
                  setLoginInputs({ username: "admin12", password: "9876" });
                } else {
                  setLoginInputs({ username: "", password: "" });
                }
              }}
            >
              Fill Demo
            </button>
          </div>

          <hr style={{ margin: "20px 0" }} />

          <h4>Signup</h4>
          <div className="form-group">
            <input
              placeholder="choose username"
              value={signupInputs.username}
              onChange={(e) =>
                setSignupInputs((s) => ({ ...s, username: e.target.value }))
              }
            />
          </div>
          <div className="form-group">
            <input
              placeholder="password"
              type="password"
              value={signupInputs.password}
              onChange={(e) =>
                setSignupInputs((s) => ({ ...s, password: e.target.value }))
              }
            />
          </div>
          <div className="form-group">
            <input
              placeholder="confirm password"
              type="password"
              value={signupInputs.confirm}
              onChange={(e) =>
                setSignupInputs((s) => ({ ...s, confirm: e.target.value }))
              }
            />
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={handleSignup}>
              Sign up
            </button>
            <button
              className="btn-outline"
              onClick={() =>
                setSignupInputs({ username: "", password: "", confirm: "" })
              }
            >
              Clear
            </button>
          </div>

          <footer
            style={{
              marginTop: 20,
              textAlign: "center",
              color: "#666",
              fontSize: 14,
            }}
          >
            Admin credentials: <b>admin12</b> / <b>9876</b>
          </footer>
        </main>
      </div>
    );
  }

  // CUSTOMER SCREEN
  if (screen === "customer") {
    const latestTicket = myTickets.length
      ? myTickets[myTickets.length - 1]
      : null;

    return (
      <div className="app-root">
        <header className="topbar">
          <h1>BankQueue Pro - Customer Portal</h1>
          <div>
            <span style={{ marginRight: 12 }}>{currentUser}</span>
            <button className="btn-sm" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <main className="container">
          <div className="card">
            <h3>Your Ticket</h3>
            <p style={{ fontSize: 32, margin: "10px 0" }}>
              {latestTicket ? `#${latestTicket.ticket_number}` : "-"}
            </p>
            <p>
              Service:{" "}
              {latestTicket ? latestTicket.service_name : "No active ticket"}
            </p>
            <p>
              Priority:{" "}
              {latestTicket
                ? latestTicket.priority_level === 3
                  ? "High"
                  : latestTicket.priority_level === 2
                  ? "Medium"
                  : "Low"
                : "-"}
            </p>
            <p>
              Time since created:{" "}
              {latestTicket
                ? formatWait(nowSeconds() - latestTicket.arrival_time)
                : "-"}
            </p>
          </div>

          <div className="card">
            <h3>Account</h3>
            {account ? (
              <>
                <div>Name: {account.full_name}</div>
                <div>ID: {account.id_number}</div>
                <div style={{ marginTop: 8 }}>
                  Balance: ${account.balance.toFixed(2)}
                </div>
              </>
            ) : (
              <div>No account yet. Create one below.</div>
            )}
          </div>

          <div className="card">
            <h3>Create Account</h3>
            <div className="form-group">
              <input
                placeholder="Full name"
                value={accountForm.fullName}
                onChange={(e) =>
                  setAccountForm((s) => ({ ...s, fullName: e.target.value }))
                }
              />
            </div>
            <div className="form-group">
              <input
                placeholder="ID number"
                value={accountForm.idNumber}
                onChange={(e) =>
                  setAccountForm((s) => ({ ...s, idNumber: e.target.value }))
                }
              />
            </div>
            <button className="btn" onClick={createAccountForCurrentUser}>
              Create Account
            </button>
          </div>

          <div className="card">
            <h3>Request Services</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                className="btn"
                onClick={() => requestService("New Account")}
              >
                New Account
              </button>
              <button
                className="btn"
                onClick={() => requestService("Deposit/Withdraw")}
              >
                Deposit / Withdraw
              </button>
              <button className="btn" onClick={() => requestService("Pay Bill")}>
                Pay Bill
              </button>
              <button
                className="btn"
                onClick={() => requestService("Loan Application")}
              >
                Loan Application
              </button>
            </div>
          </div>

          <div className="card">
            <h3>My Tickets (this session)</h3>
            {myTickets.length ? (
              <ul className="list">
                {myTickets.map((t) => (
                  <li key={t.ticket_number} className="list-item">
                    <div>#{t.ticket_number}</div>
                    <div>{t.service_name}</div>
                    <div>
                      Priority:{" "}
                      {t.priority_level === 3
                        ? "High"
                        : t.priority_level === 2
                        ? "Medium"
                        : "Low"}
                    </div>
                    <div>{formatWait(nowSeconds() - t.arrival_time)}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div>No tickets yet.</div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ADMIN SCREEN
  return (
    <div className="app-root">
      <header className="topbar">
        <h1>BankQueue Pro - Admin Panel</h1>
        <div>
          <button className="btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="container">
        <div className="grid-4">
          <div className="card stat">
            <div className="stat-value">{metrics.customersWaiting}</div>
            <div className="stat-label">Customers Waiting</div>
          </div>
          <div className="card stat">
            <div className="stat-value">
              {formatWait(metrics.avgWait)}
            </div>
            <div className="stat-label">Average Wait</div>
          </div>
          <div className="card stat">
            <div className="stat-value">
              {formatWait(metrics.p90Wait)}
            </div>
            <div className="stat-label">P90 Wait</div>
          </div>
          <div className="card stat">
            <div className="stat-value">{metrics.servedToday}</div>
            <div className="stat-label">Served Today</div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div
            className="row"
            style={{ justifyContent: "space-between", alignItems: "center" }}
          >
            <h3>Current Waiting Queue</h3>
            <button className="btn-success" onClick={serveNextCustomer}>
              Serve Next Customer
            </button>
          </div>

          <ul className="list">
            {queue.length ? (
              queue.map((t) => (
                <li className="list-item" key={t.ticket_number}>
                  <div>#{t.ticket_number}</div>
                  <div>{t.customer_name}</div>
                  <div>{t.service_name}</div>
                  <div>
                    Priority:{" "}
                    {t.priority_level === 3
                      ? "High"
                      : t.priority_level === 2
                      ? "Medium"
                      : "Low"}
                  </div>
                  <div>{formatWait(nowSeconds() - t.arrival_time)}</div>
                </li>
              ))
            ) : (
              <li>No customers in queue.</li>
            )}
          </ul>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h3>Change Ticket Priority</h3>
          <div className="form-inline">
            <input
              placeholder="Ticket number"
              value={priorityTicketNumber}
              onChange={(e) => setPriorityTicketNumber(e.target.value)}
            />
            <select
              value={priorityLevel}
              onChange={(e) => setPriorityLevel(Number(e.target.value))}
            >
              <option value={3}>High</option>
              <option value={2}>Medium</option>
              <option value={1}>Low</option>
            </select>
            <button className="btn" onClick={changeTicketPriority}>
              Update
            </button>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h3>Service History</h3>
          {history.length ? (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Wait</th>
                  <th>Counter</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.ticket_number}>
                    <td>#{r.ticket_number}</td>
                    <td>{r.customer_name}</td>
                    <td>{r.service_name}</td>
                    <td>{formatWait(r.total_wait_time)}</td>
                    <td>{r.counter_identifier}</td>
                    <td>
                      {new Date(
                        r.service_end_time * 1000
                      ).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div>No history yet.</div>
          )}
        </div>
      </main>
    </div>
  );
}
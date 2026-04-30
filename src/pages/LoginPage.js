import { useState } from "react";
import API from "../api/apiClient";
import { useNavigate } from "react-router-dom";

function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();

    const handleLogin = async () => {
        try {
            const res = await API.post("/auth/login", { email, password });
            localStorage.setItem("token", res.data);
            navigate("/dashboard");
        } catch (err) {
            alert("Login Failed");
        }
    };

    return (
        <div>
            <h1>Login</h1>
            <input placeholder="Email" onChange={(e)=>setEmail(e.target.value)} />
            <input placeholder="Password" type="password" onChange={(e)=>setPassword(e.target.value)} />
            <button onClick={handleLogin}>Login</button>
            <p>
                New user? <button type="button" onClick={() => navigate("/register")}>Go to signup</button>
            </p>
        </div>
    );
}

export default LoginPage;

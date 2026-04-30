import { useState } from "react";
import API from "../api/apiClient";
import { useNavigate } from "react-router-dom";

function RegisterPage() {
    const navigate = useNavigate();
    const [data, setData] = useState({
        fullName: "",
        email: "",
        password: "",
        otp: "",
    });
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSendOtp = async () => {
        if (!data.email.trim()) {
            setMessage("Enter your email first.");
            return;
        }

        setLoading(true);
        setMessage("");
        try {
            const res = await API.post("/auth/signup/send-otp", null, {
                params: { email: data.email.trim() },
            });
            const otpPreview = res?.data?.otp ? ` OTP: ${res.data.otp}` : "";
            setMessage(`Signup OTP sent to your email.${otpPreview}`);
        } catch (error) {
            setMessage(error?.response?.data || "Failed to send signup OTP.");
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async () => {
        if (!data.fullName.trim() || !data.email.trim() || !data.password || !data.otp.trim()) {
            setMessage("Fill full name, email, password and OTP.");
            return;
        }

        setLoading(true);
        setMessage("");
        try {
            await API.post("/auth/signup", {
                fullName: data.fullName.trim(),
                email: data.email.trim(),
                password: data.password,
                otp: data.otp.trim(),
            });
            alert("Registered successfully. Now login.");
            navigate("/");
        } catch (error) {
            setMessage(error?.response?.data || "Registration failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h1>Signup</h1>
            <input placeholder="Full Name" value={data.fullName} onChange={(e)=>setData({...data, fullName:e.target.value})}/>
            <input placeholder="Email" value={data.email} onChange={(e)=>setData({...data, email:e.target.value})}/>
            <button onClick={handleSendOtp} disabled={loading}>
                {loading ? "Sending OTP..." : "Send Signup OTP"}
            </button>
            <input placeholder="Password" type="password" value={data.password} onChange={(e)=>setData({...data, password:e.target.value})}/>
            <input placeholder="Enter OTP" value={data.otp} onChange={(e)=>setData({...data, otp:e.target.value})}/>
            <button onClick={handleRegister} disabled={loading}>
                {loading ? "Creating..." : "Register"}
            </button>
            {message ? <p>{message}</p> : null}
        </div>
    );
}

export default RegisterPage;

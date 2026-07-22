import { useState } from "react";
import { Box, Stack, Alert, Collapse } from "@mui/material";
import { CyberInput, CyberButton } from "../../customs/CyberInputs";
import { CyberCheckbox } from "../../customs/CyberCheckbox";
import { UI_COLORS } from "../../../constants/uiColors";
import { ROLES } from "../../../constants/roles";
import { registerPlayer } from "../../../../firebase/playersAuth";
import { linkNewPlayerToCampaign } from "../../../../firebase/services/playerAdminService";

export default function AddPlayerForm({ campaignId, onEnrolled }) {
    const [formData, setFormData] = useState({ nickname: "", password: "", isDM: false });
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ type: "", msg: "", open: false });

    const handleChange = (field) => (e) => {
        setFormData({ ...formData, [field]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!campaignId) return;
        setLoading(true);
        setStatus({ ...status, open: false });

        try {
            const role = formData.isDM ? ROLES.DM : ROLES.PLAYER;
            const user = await registerPlayer(formData.nickname, formData.password, role, campaignId);
            await linkNewPlayerToCampaign(user.uid, campaignId);
            setStatus({
                type: "success",
                msg: "Usuario inscrito y vinculado a la campaña activa.",
                open: true,
            });
            setFormData({ nickname: "", password: "", isDM: false });
            onEnrolled?.();
        } catch (error) {
            console.error("Enrollment error:", error);
            setStatus({
                type: "error",
                msg: `Error al inscribir: ${error.code || error.message || "rechazo del sistema"}`,
                open: true,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 520 }}>
            <Collapse in={status.open}>
                <Alert
                    severity={status.type === "success" ? "success" : "error"}
                    sx={{
                        mb: 2,
                        bgcolor: status.type === "success" ? `${UI_COLORS.anomaly}14` : `${UI_COLORS.accentStrong}14`,
                        color: UI_COLORS.textPrimary,
                        border: `1px solid ${status.type === "success" ? UI_COLORS.anomaly : UI_COLORS.accentStrong}`,
                    }}
                    onClose={() => setStatus({ ...status, open: false })}
                >
                    {status.msg}
                </Alert>
            </Collapse>

            <form onSubmit={handleSubmit}>
                <Stack spacing={2}>
                    <CyberInput
                        label="NICKNAME"
                        value={formData.nickname}
                        onChange={handleChange("nickname")}
                        allowAutofill={false}
                        required
                    />
                    <CyberInput
                        label="CONTRASEÑA"
                        type="new-password"
                        value={formData.password}
                        onChange={handleChange("password")}
                        allowAutofill={false}
                        required
                    />
                    <CyberCheckbox
                        name="isDM"
                        label="Otorgar rol de DJ (Dungeon Master)"
                        checked={formData.isDM}
                        onChange={(e) => setFormData({ ...formData, isDM: e.target.checked })}
                    />
                    <Box>
                        <CyberButton loading={loading}>INSCRIBIR USUARIO</CyberButton>
                    </Box>
                </Stack>
            </form>
        </Box>
    );
}

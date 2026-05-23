
export interface RegisterPayloadType {
    name: string;
    email: string;
    password: string;
}

export interface LoginPayloadType {
    email: string;
    password: string;
}

export interface LoginResponseType {
    accessToken: string;
    expiresAt: string;
    user: {
        id: string;
        _id?: string;
        name: string;
        email: string;
        profilePicture: string;
        role: "USER" | "ADMIN";
        status: "ACTIVE" | "DISABLED";
    },
    reportSetting: {
        id: string;
        frequency: string;
        isEnabled: boolean;
    }
}

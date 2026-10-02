export interface IUserDto {
  id: string;
  name: string;
  email: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAuthResult {
  user: IUserDto;
  token: string;
}

export interface IRegisterResult {
  userId: string;
  email: string;
  message: string;
}

export interface IOtpVerificationResult {
  user: IUserDto;
  token: string;
  message: string;
}

export interface IResendOtpResult {
  message: string;
  cooldownSeconds: number;
}

export interface IForgotPasswordResult {
  message: string;
}

export interface IResetPasswordResult {
  message: string;
}

import bcrypt from "bcryptjs";
import jwt, {
  type JwtPayload,
  type Secret,
  type SignOptions,
} from "jsonwebtoken";


import {
  UserRole,
  UserStatus,
} from "../../generated/prisma/enums.js";

import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";

import { AppError } from "../../common/errors/app-error.js";

import type {
  BuyerRegistrationInput,
  CooperativeRegistrationInput,
  DriverRegistrationInput,
  LoginInput,
} from "./auth.validation.js";


/**
 * ============================================================
 * AUTH SERVICE
 * ============================================================
 *
 * This service contains the business logic for authentication.
 *
 * Responsibilities:
 *
 * - Register buyers
 * - Register cooperatives
 * - Register drivers
 * - Hash passwords
 * - Authenticate users
 * - Generate JWT access tokens
 * - Generate JWT refresh tokens
 * - Verify refresh tokens
 * - Return the currently authenticated user
 *
 * Controllers should remain thin.
 *
 * The controller receives HTTP requests.
 * The service performs the actual business logic.
 */


/**
 * ============================================================
 * PASSWORD CONFIGURATION
 * ============================================================
 *
 * bcrypt uses a cost factor to determine how expensive password
 * hashing should be.
 *
 * 12 is sufficiently expensive for our current application
 * without making development painfully slow.
 */
const PASSWORD_SALT_ROUNDS = 12;


/**
 * ============================================================
 * JWT PAYLOAD
 * ============================================================
 *
 * This is the information we deliberately store inside our JWT.
 *
 * We do NOT put sensitive information such as:
 *
 * - passwordHash
 * - phone number
 * - email
 *
 * inside the token.
 *
 * `sub` (subject) will contain the User ID.
 *
 * `role` allows authorization middleware to determine whether
 * the authenticated user is a BUYER, COOPERATIVE, DRIVER or
 * ADMIN.
 */
interface AuthTokenPayload extends JwtPayload {
  role: UserRole;
  tokenType: "access" | "refresh";
}


/**
 * ============================================================
 * PUBLIC USER SHAPE
 * ============================================================
 *
 * We should NEVER return passwordHash to the frontend.
 *
 * This helper creates the safe representation of a User that
 * can be included in API responses.
 */
function toPublicUser(user: {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  phoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role,
    status: user.status,
    phoneVerified: user.phoneVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}


/**
 * ============================================================
 * CHECK WHETHER USER ALREADY EXISTS
 * ============================================================
 *
 * Phone numbers are unique.
 * Emails are also unique when supplied.
 *
 * We check both before registration so the API can return a
 * useful 409 Conflict response rather than exposing a raw
 * database constraint error.
 */
async function ensureUserDoesNotExist(
  phone: string,
  email?: string,
): Promise<void> {
  /**
   * Build the OR conditions.
   *
   * We always check the phone.
   *
   * We only check the email when the caller actually supplied
   * one.
   *
   * This avoids explicitly passing undefined into Prisma.
   */
  const conditions: Array<
    | { phone: string }
    | { email: string }
  > = [
    {
      phone,
    },
  ];

  if (email !== undefined) {
    conditions.push({
      email,
    });
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: conditions,
    },
    select: {
      phone: true,
      email: true,
    },
  });


  /**
   * No matching account means registration can continue.
   */
  if (!existingUser) {
    return;
  }


  /**
   * Return a more specific error where possible.
   */
  if (existingUser.phone === phone) {
    throw new AppError(
      "An account already exists with this phone number.",
      409,
    );
  }


  if (
    email !== undefined &&
    existingUser.email === email
  ) {
    throw new AppError(
      "An account already exists with this email address.",
      409,
    );
  }


  throw new AppError(
    "An account already exists with the supplied credentials.",
    409,
  );
}


/**
 * ============================================================
 * HASH PASSWORD
 * ============================================================
 *
 * Raw passwords must never be stored in PostgreSQL.
 *
 * Example:
 *
 * User sends:
 *
 * MyPassword123
 *
 * We store something similar to:
 *
 * $2b$12$....
 *
 * bcrypt.compare() can later check the password without us
 * knowing or storing the original password.
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(
    password,
    PASSWORD_SALT_ROUNDS,
  );
}


/**
 * ============================================================
 * GENERATE ACCESS TOKEN
 * ============================================================
 *
 * Access tokens are short-lived.
 *
 * The Angular frontend will send this token with protected API
 * requests:
 *
 * Authorization: Bearer <access-token>
 */
function generateAccessToken(user: {
  id: string;
  role: UserRole;
}): string {
  const options: SignOptions = {
    subject: user.id,

    /**
     * 15 minutes expressed in seconds.
     *
     * jsonwebtoken interprets numeric expiresIn values as seconds.
     */
    expiresIn: 15 * 60,

    algorithm: "HS256",
  };

  const payload: AuthTokenPayload = {
  role: user.role,
  tokenType: "access",
};

  return jwt.sign(
    payload,
    env.JWT_ACCESS_SECRET as Secret,
    options,
  );
}


function generateRefreshToken(user: {
  id: string;
  role: UserRole;
}): string {
  const options: SignOptions = {
    subject: user.id,

    /**
     * 7 days expressed in seconds.
     */
    expiresIn: 7 * 24 * 60 * 60,

    algorithm: "HS256",
  };

  const payload: AuthTokenPayload = {
  role: user.role,
  tokenType: "refresh",
};

  return jwt.sign(
    payload,
    env.JWT_REFRESH_SECRET as Secret,
    options,
  );
}


/**
 * ============================================================
 * GENERATE REFRESH TOKEN
 * ============================================================
 *
 * Refresh tokens live longer than access tokens.
 *
 * Their purpose is to allow a client to obtain a new access
 * token without forcing the user to enter their password every
 * 15 minutes.
 *
 * We deliberately keep the refresh token payload small.
 */



/**
 * ============================================================
 * GENERATE TOKEN PAIR
 * ============================================================
 *
 * Both registration/login flows need the same pair of tokens,
 * so we keep the logic in one reusable function.
 */
function generateTokenPair(user: {
  id: string;
  role: UserRole;
}) {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user),
  };
}


/**
 * ============================================================
 * REGISTER BUYER
 * ============================================================
 *
 * Creates:
 *
 * User
 *  └── BuyerProfile
 *
 * using one Prisma nested write.
 *
 * Prisma treats this nested create atomically:
 *
 * If User creation fails:
 *      nothing is created.
 *
 * If BuyerProfile creation fails:
 *      User creation is rolled back.
 */
async function registerBuyer(
  input: BuyerRegistrationInput,
) {
  /**
   * Prevent duplicate phone/email accounts.
   */
  await ensureUserDoesNotExist(
    input.phone,
    input.email,
  );


  /**
   * Hash the password BEFORE writing it to PostgreSQL.
   */
  const passwordHash = await hashPassword(
    input.password,
  );


  /**
   * BuyerProfile contains nullable fields.
   *
   * Prisma represents those fields as:
   *
   * string | null
   *
   * With exactOptionalPropertyTypes enabled, explicitly sending
   * `undefined` is different from omitting a property.
   *
   * Therefore we convert optional input values to null.
   */
  const businessName =
    input.businessName ?? null;

  const deliveryAddress =
    input.deliveryAddress ?? null;


  /**
   * Create User + BuyerProfile together.
   */
  const user = await prisma.user.create({
    data: {
      fullName: input.fullName,
      phone: input.phone,

      /**
       * Prisma's email column is nullable.
       */
      email: input.email ?? null,

      passwordHash,

      role: UserRole.BUYER,

      /**
       * For our MVP, buyer accounts become active immediately.
       *
       * Cooperatives and drivers are treated differently because
       * they require operational verification.
       */
      status: UserStatus.ACTIVE,

      buyerProfile: {
        create: {
          buyerType: input.buyerType,
          businessName,
          city: input.city,
          deliveryAddress,
        },
      },
    },

    /**
     * Include the newly created buyer profile in the response.
     */
    include: {
      buyerProfile: true,
    },
  });


  /**
   * Generate authentication tokens.
   */
  const tokens = generateTokenPair(user);


  /**
   * Never expose passwordHash.
   */
  return {
    user: toPublicUser(user),
    profile: user.buyerProfile,
    ...tokens,
  };
}


/**
 * ============================================================
 * REGISTER COOPERATIVE
 * ============================================================
 *
 * Creates:
 *
 * User
 *  └── CooperativeProfile
 *
 * Cooperative accounts remain PENDING because the platform
 * should verify suppliers before allowing them to operate as
 * trusted agricultural sellers.
 */
async function registerCooperative(
  input: CooperativeRegistrationInput,
) {
  await ensureUserDoesNotExist(
    input.phone,
    input.email,
  );


  const passwordHash = await hashPassword(
    input.password,
  );


  /**
   * Convert optional values to null rather than passing
   * undefined to Prisma.
   */
  const description =
    input.description ?? null;

  const region =
    input.region ?? null;

  const locality =
    input.locality ?? null;


  const user = await prisma.user.create({
    data: {
      fullName: input.fullName,
      phone: input.phone,
      email: input.email ?? null,
      passwordHash,

      role: UserRole.COOPERATIVE,

      /**
       * Cooperative must later be approved by an administrator.
       */
      status: UserStatus.PENDING,

      cooperativeProfile: {
        create: {
          name: input.name,
          description,
          region,
          city: input.city,
          locality,
        },
      },
    },

    include: {
      cooperativeProfile: true,
    },
  });


  /**
   * IMPORTANT:
   *
   * We do NOT issue normal authentication tokens here.
   *
   * The account is still pending verification.
   *
   * This prevents an unverified cooperative from registering and
   * immediately accessing protected seller functionality.
   */
  return {
    user: toPublicUser(user),
    profile: user.cooperativeProfile,

    message:
      "Cooperative registration submitted successfully. Your account is pending verification.",
  };
}


/**
 * ============================================================
 * REGISTER DRIVER
 * ============================================================
 *
 * Creates:
 *
 * User
 *  └── DriverProfile
 *
 * Drivers remain PENDING until verified.
 *
 * This is particularly important because drivers will eventually
 * be responsible for real agricultural shipments.
 */
async function registerDriver(
  input: DriverRegistrationInput,
) {
  await ensureUserDoesNotExist(
    input.phone,
    input.email,
  );


  const passwordHash = await hashPassword(
    input.password,
  );


  /**
   * Nullable Prisma fields should receive null rather than
   * undefined.
   */
  const licenseNumber =
    input.licenseNumber ?? null;

  const city =
    input.city ?? null;


  const user = await prisma.user.create({
    data: {
      fullName: input.fullName,
      phone: input.phone,
      email: input.email ?? null,
      passwordHash,

      role: UserRole.DRIVER,

      /**
       * Driver cannot become operational until verified.
       */
      status: UserStatus.PENDING,

      driverProfile: {
        create: {
          licenseNumber,
          city,

          /**
           * Even after verification, the driver must explicitly
           * indicate availability before dispatch.
           */
          isAvailable: false,
        },
      },
    },

    include: {
      driverProfile: true,
    },
  });


  return {
    user: toPublicUser(user),
    profile: user.driverProfile,

    message:
      "Driver registration submitted successfully. Your account is pending verification.",
  };
}


/**
 * ============================================================
 * LOGIN
 * ============================================================
 *
 * Users can authenticate using either:
 *
 * - phone number
 * - email address
 *
 * The validation layer supplies the `identifier`.
 */
async function login(input: LoginInput) {
  /**
   * Search by either phone or email.
   */
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        {
          phone: input.identifier,
        },
        {
          email: input.identifier,
        },
      ],
    },
  });


  /**
   * We deliberately use a generic error message.
   *
   * Avoid:
   *
   * "Email doesn't exist"
   *
   * because that reveals whether a particular account exists.
   */
  if (!user) {
    throw new AppError(
      "Invalid login credentials.",
      401,
    );
  }


  /**
   * Compare the submitted password against the stored bcrypt
   * hash.
   */
  const passwordMatches = await bcrypt.compare(
    input.password,
    user.passwordHash,
  );


  if (!passwordMatches) {
    throw new AppError(
      "Invalid login credentials.",
      401,
    );
  }


  /**
   * Suspended users cannot authenticate.
   */
  if (user.status === UserStatus.SUSPENDED) {
    throw new AppError(
      "Your account has been suspended.",
      403,
    );
  }


  /**
   * Rejected users cannot authenticate.
   */
  if (user.status === UserStatus.REJECTED) {
    throw new AppError(
      "Your account registration was rejected.",
      403,
    );
  }


  /**
   * Pending cooperatives/drivers should not gain access to their
   * operational portals before approval.
   */
  if (user.status === UserStatus.PENDING) {
    throw new AppError(
      "Your account is still pending verification.",
      403,
    );
  }


  /**
   * Only active users reach this point.
   */
  if (user.status !== UserStatus.ACTIVE) {
    throw new AppError(
      "Your account is not active.",
      403,
    );
  }


  const tokens = generateTokenPair(user);


  return {
    user: toPublicUser(user),
    ...tokens,
  };
}


/**
 * ============================================================
 * REFRESH ACCESS TOKEN
 * ============================================================
 *
 * A valid refresh token can be exchanged for a fresh access
 * token.
 *
 * This prevents users from having to log in every time their
 * short-lived access token expires.
 */
async function refreshAccessToken(
  refreshToken: string,
) {
  let decoded: string | JwtPayload;


  try {
    /**
     * Verify:
     *
     * 1. Signature
     * 2. Expiration
     * 3. Expected algorithm
     */
    decoded = jwt.verify(
      refreshToken,
      env.JWT_REFRESH_SECRET as Secret,
      {
        algorithms: ["HS256"],
      },
    );
  } catch {
    throw new AppError(
      "Invalid or expired refresh token.",
      401,
    );
  }


  /**
   * Our tokens always contain an object payload.
   */
  if (
    typeof decoded === "string" ||
    typeof decoded.sub !== "string"
  ) {
    throw new AppError(
      "Invalid refresh token.",
      401,
    );
  }

  if (decoded.tokenType !== "refresh") {
  throw new AppError(
    "Invalid refresh token.",
    401,
  );
}


  /**
   * Never trust the role inside a refresh token as the current
   * source of truth.
   *
   * Load the user again from PostgreSQL.
   *
   * This means if an admin suspends the account after the refresh
   * token was created, the user cannot keep generating new access
   * tokens indefinitely.
   */
  const user = await prisma.user.findUnique({
    where: {
      id: decoded.sub,
    },
  });


  if (!user) {
    throw new AppError(
      "User account no longer exists.",
      401,
    );
  }


  if (user.status !== UserStatus.ACTIVE) {
    throw new AppError(
      "Your account is not active.",
      403,
    );
  }


  /**
   * Generate a new short-lived access token.
   *
   * We currently keep the existing refresh token.
   *
   * Later, if we implement persisted refresh-token rotation, this
   * can be strengthened further.
   */
  const accessToken = generateAccessToken(user);


  return {
    accessToken,
  };
}


/**
 * ============================================================
 * GET CURRENT USER
 * ============================================================
 *
 * Used by:
 *
 * GET /api/v1/auth/me
 *
 * Authentication middleware first verifies the access token and
 * places the User ID on req.user.
 *
 * This function then loads the current database state.
 */
async function getCurrentUser(
  userId: string,
) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    include: {
      buyerProfile: true,
      cooperativeProfile: true,
      driverProfile: true,
    },
  });


  if (!user) {
    throw new AppError(
      "User account not found.",
      404,
    );
  }


  /**
   * Return only the profile corresponding to the user's role.
   */
  let profile:
    | typeof user.buyerProfile
    | typeof user.cooperativeProfile
    | typeof user.driverProfile
    | null = null;


  switch (user.role) {
    case UserRole.BUYER:
      profile = user.buyerProfile;
      break;

    case UserRole.COOPERATIVE:
      profile = user.cooperativeProfile;
      break;

    case UserRole.DRIVER:
      profile = user.driverProfile;
      break;

    case UserRole.ADMIN:
      /**
       * Admin currently has no role-specific profile.
       */
      profile = null;
      break;
  }


  return {
    user: toPublicUser(user),
    profile,
  };
}


/**
 * ============================================================
 * AUTH SERVICE EXPORT
 * ============================================================
 *
 * Controllers import this object instead of importing every
 * internal function individually.
 */
export const authService = {
  registerBuyer,
  registerCooperative,
  registerDriver,
  login,
  refreshAccessToken,
  getCurrentUser,
};
# The Owner is pinned by GitHub account ID in deployment config

acta is single-Owner and signs in only through GitHub OAuth (no passwords). A "first visitor becomes the Owner" rule would let anyone who reaches a fresh deployment's URL first take the Instance, so the Owner's numeric GitHub account ID is set in deployment configuration and every other GitHub account is rejected, including on the very first sign-in. We key on the numeric ID rather than the email because a GitHub email can be changed or kept private, while the account ID is permanent.

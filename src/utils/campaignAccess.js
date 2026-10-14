/**
 * Campaign is visible if the user is owner/member, or (legacy) listed in
 * profile.campaignIds — except owner_only / eval pilots, which require real membership.
 */
export function canAccessCampaign(camp, uid, profileCampaignIds = []) {
    if (!uid || !camp) return false;

    const isOwner = camp.ownerId === uid;
    const isMember = Array.isArray(camp.playerIds) && camp.playerIds.includes(uid);
    const inProfile = Array.isArray(profileCampaignIds) && profileCampaignIds.includes(camp.id);
    const restricted = camp.access === "owner_only" || camp.isEvalPilot === true;

    // Eval / owner-only: hard membership only.
    if (restricted) return isOwner || isMember;

    // Normal table campaigns (e.g. Valtia): member, owner, or profile grant.
    return isOwner || isMember || inProfile;
}

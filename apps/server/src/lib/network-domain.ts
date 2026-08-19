export interface NetworkPersonState {
  accountType: "artist" | "fan";
  avatarUrl: string | null;
  canMessage: boolean;
  email: string | null;
  followsYou: boolean;
  id: string;
  isFollowing: boolean;
  isFriend: boolean;
  name: string;
  username: string | null;
}

export type NetworkRelationshipFlags = Pick<
  NetworkPersonState,
  "followsYou" | "isFollowing" | "isFriend"
>;

export const mergeNetworkPerson = (
  people: Map<string, NetworkPersonState>,
  person: NetworkPersonState,
  flags: Partial<NetworkRelationshipFlags>
) => {
  const existing = people.get(person.id);
  people.set(person.id, {
    ...(existing ?? person),
    ...person,
    canMessage: Boolean(
      existing?.canMessage || person.canMessage || flags.isFriend
    ),
    followsYou: Boolean(existing?.followsYou || flags.followsYou),
    isFollowing: Boolean(existing?.isFollowing || flags.isFollowing),
    isFriend: Boolean(existing?.isFriend || flags.isFriend),
  });
};

export const sortNetworkPeople = (people: Iterable<NetworkPersonState>) =>
  [...people].sort((left, right) => left.name.localeCompare(right.name));

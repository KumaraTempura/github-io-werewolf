import { CAMP_GROUPS, rolesForCamp } from './roster'

export default function RoleOptions() {
  return (
    <>
      {CAMP_GROUPS.map(({ key, label }) => (
        <optgroup key={key} label={label}>
          {rolesForCamp(key).map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  )
}

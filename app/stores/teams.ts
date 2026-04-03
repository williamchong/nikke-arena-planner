import type { TeamComposition } from '~/types/template'

export const useTeamsStore = defineStore('teams', () => {
  const recommended5v5 = ref<TeamComposition[]>([])
  const recommended15v15 = ref<TeamComposition[][]>([])
  const savedTeams = ref<TeamComposition[]>([])

  function setRecommended5v5(teams: TeamComposition[]) {
    recommended5v5.value = teams
  }

  function setRecommended15v15(teamSets: TeamComposition[][]) {
    recommended15v15.value = teamSets
  }

  function saveTeam(team: TeamComposition) {
    savedTeams.value = [...savedTeams.value, team]
  }

  function removeTeam(id: string) {
    savedTeams.value = savedTeams.value.filter(t => t.id !== id)
  }

  return {
    recommended5v5,
    recommended15v15,
    savedTeams,
    setRecommended5v5,
    setRecommended15v15,
    saveTeam,
    removeTeam,
  }
})

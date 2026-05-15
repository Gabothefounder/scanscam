function refreshSurveyExperimentTabs_() {
  const surveyExperimentRows = fetchViewRows_(
    CFG.VIEWS.SURVEY_EXPERIMENTS,
    "created_at.desc"
  );
  writeTab_(CFG.TABS.SURVEY_EXPERIMENTS, surveyExperimentRows);
}

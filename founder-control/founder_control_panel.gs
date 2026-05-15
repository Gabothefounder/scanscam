function refreshFounderControlPanel() {
  assertConfig_();
  ensureFounderFacingTabs_();

  const funnelRows = fetchViewRows_(CFG.VIEWS.FUNNEL);
  const researchFunnelRows = fetchViewRows_(CFG.VIEWS.RESEARCH_FUNNEL);
  const eventHealthRows = fetchViewRows_(CFG.VIEWS.EVENT_HEALTH);
  const ctaRows = fetchViewRows_(CFG.VIEWS.CTA);
  const acquisitionRows = fetchViewRows_(CFG.VIEWS.ACQUISITION_SIGNAL);
  const userResearchRows = fetchViewRows_(
    CFG.VIEWS.USER_RESEARCH,
    "submitted_at.desc"
  );

  writeTab_(CFG.TABS.FUNNEL, funnelRows);
  writeTab_(CFG.TABS.CTA, ctaRows);
  writeTab_(CFG.TABS.ACQUISITION_SIGNAL_QUALITY, acquisitionRows);
  writeTab_(CFG.TABS.USER_RESEARCH, userResearchRows);

  refreshSurveyExperimentTabs_();

  const dailyResult = buildDailyPulse_(researchFunnelRows, eventHealthRows);
  buildWeeklyControlPanel_(researchFunnelRows, acquisitionRows, userResearchRows);

  stampRefresh_({
    sourceViews: [
      CFG.VIEWS.FUNNEL,
      CFG.VIEWS.RESEARCH_FUNNEL,
      CFG.VIEWS.EVENT_HEALTH,
      CFG.VIEWS.CTA,
      CFG.VIEWS.ACQUISITION_SIGNAL,
      CFG.VIEWS.USER_RESEARCH,
      CFG.VIEWS.SURVEY_EXPERIMENTS,
    ],
    selectedDate: dailyResult.selectedDate,
    dayStatus: dailyResult.dayStatus,
    warnings: dailyResult.warnings,
  });
}

const productionTarget = "rocktownlabs/soundkit/main",
  stagingTarget = "rocktownlabs/soundkit/staging";

export function deploymentEnvironment(stage, localDev = false) {
  if (typeof stage !== "string" || !/^[a-z0-9-]{1,63}$/u.test(stage)) {
    throw new Error("Invalid deployment stage");
  }
  const preview = /^pr-[1-9]\d*$/u.test(stage);
  if (!(localDev || stage === "prod" || stage === "staging" || preview)) {
    throw new Error("Unsupported deployment stage");
  }
  let analyticsEnvironment = "test",
    kind = "local";
  if (!localDev) {
    if (stage === "prod") {
      kind = "production";
    } else if (stage === "staging") {
      kind = "staging";
    } else {
      kind = "preview";
    }
  }
  if (kind === "production") {
    analyticsEnvironment = "production";
  } else if (preview && !localDev) {
    analyticsEnvironment = stage;
  }
  return {
    analyticsEnvironment,
    databaseTargets:
      kind === "production"
        ? [productionTarget]
        : [
            stagingTarget,
            ...(preview ? [`rocktownlabs/soundkit/${stage}`] : []),
            ...(localDev ? ["local"] : []),
          ],
    isLocalDev: localDev,
    isProduction: stage === "prod",
    isPullRequestPreview: preview && !localDev,
    kind,
    scheduledJobsEnabled: kind === "production",
    stage,
  };
}

export function isolationMode(mode = "report") {
  if (mode !== "report" && mode !== "enforce") {
    throw new Error("Invalid deployment isolation mode");
  }
  return mode;
}

/** Return bounded codes only: inputs may contain credentials. */
export function isolationFindings(environment, configuration) {
  const findings = [];
  if (!environment.databaseTargets.includes(configuration.databaseTarget)) {
    findings.push("database_target_unapproved");
  }
  if (environment.kind === "production") {
    if (configuration.mediaBucket !== "soundkit-media") {
      findings.push("production_media_identity_changed");
    }
    if (!/^(?:sk|rk)_live_/u.test(configuration.stripeKey ?? "")) {
      findings.push("production_stripe_mode_invalid");
    }
    return findings;
  }
  if (
    !/^soundkit-media-(?:staging|local|pr-[1-9]\d*)$/u.test(
      configuration.mediaBucket ?? ""
    )
  ) {
    findings.push("nonproduction_media_identity_invalid");
  }
  if (configuration.scheduledJobsEnabled) {
    findings.push("nonproduction_scheduled_jobs_enabled");
  }
  if (
    configuration.stripeKey &&
    !/^(?:sk|rk)_test_/u.test(configuration.stripeKey)
  ) {
    findings.push("nonproduction_stripe_mode_invalid");
  }
  if (configuration.externalEffects !== "disabled") {
    findings.push("nonproduction_external_effects_not_disabled");
  }
  if (configuration.hasFulfillmentCredentials) {
    findings.push("nonproduction_fulfillment_credentials");
  }
  if (configuration.hasEmailCredentials) {
    findings.push("nonproduction_email_credentials");
  }
  return findings;
}

export function databaseIdentityFinding(
  environment,
  declaredTarget,
  actualTarget
) {
  if (
    !environment.databaseTargets.includes(actualTarget) ||
    declaredTarget !== actualTarget
  ) {
    return "database_identity_mismatch";
  }
  return null;
}

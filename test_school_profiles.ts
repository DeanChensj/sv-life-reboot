// Behavior-lock test for the SCHOOL_PROFILES table (src/data/schoolProfiles.ts).
// Guards the display labels, tuition, milestone recording, and top-tier CS qualifications.
import { generateInitialState, events } from './src/data/events';
import { getJobDisplayInfo } from './src/utils/gameStateSelectors';
import { SCHOOL_PROFILES, isTopTierCSSchool, getSchoolProfile } from './src/data/schoolProfiles';
import { GameState } from './src/types';

console.log('--- [school-profiles] label + tier behavior lock ---');
let fail = 0;
const check = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { console.error(`❌ ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); fail++; }
  else console.log(`✅ ${name}`);
};

const mkStudent = (over: Partial<GameState>): GameState =>
  ({ ...generateInitialState(), job_type: undefined, ...over } as unknown as GameState);

// 1. Undergrad label checks
check('undergrad label cmu', getJobDisplayInfo(mkStudent({ school: 'cmu' })).companyLabel, 'CMU (CS 四大)');
check('undergrad label ucb', getJobDisplayInfo(mkStudent({ school: 'ucb' })).companyLabel, 'UCB (加州伯克利)');
check('undergrad label state', getJobDisplayInfo(mkStudent({ school: 'state' })).companyLabel, 'SJSU (加州州立)');
check('undergrad label cn', getJobDisplayInfo(mkStudent({ school: 'cn' })).companyLabel, '国内重点高校');

// 2. Master label checks
check('master label cmu', getJobDisplayInfo(mkStudent({ school: 'cmu', is_master: true })).companyLabel, 'CMU CS 硕士');
check('master label ucb', getJobDisplayInfo(mkStudent({ school: 'ucb', is_master: true })).companyLabel, 'UCB CS 硕士');
check('master label state', getJobDisplayInfo(mkStudent({ school: 'state', is_master: true })).companyLabel, 'SJSU CS 硕士');

// 3. PhD lab label checks
check('phd lab cmu', getJobDisplayInfo(mkStudent({ school: 'cmu', is_phd: true })).companyLabel, 'CMU 博士实验室');
check('phd lab ucb', getJobDisplayInfo(mkStudent({ school: 'ucb', is_phd: true })).companyLabel, 'UCB 博士实验室');

// 4. Top-Tier CS classification checks
check('top-tier CS cmu', isTopTierCSSchool('cmu'), true);
check('top-tier CS ucb', isTopTierCSSchool('ucb'), true);
check('top-tier CS state', isTopTierCSSchool('state'), false);
check('top-tier CS cn', isTopTierCSSchool('cn'), false);
check('top-tier CS undefined', isTopTierCSSchool(undefined), false);

// 5. Table completeness checks
for (const [slug, profile] of Object.entries(SCHOOL_PROFILES)) {
  check(`table entry ${slug}`, profile.slug, slug);
  check(`table profile lookup ${slug}`, getSchoolProfile(slug)?.name, profile.name);
  check(`table undergradLabel ${slug}`, getJobDisplayInfo(mkStudent({ school: slug })).companyLabel, profile.undergradLabel);
}

// 6. choose_school event choices match SCHOOL_PROFILES
const chooseSchoolEvent = events['choose_school'];
check('choose_school choices length', chooseSchoolEvent.choices.length, 4);

console.log(fail === 0 ? '\n🎉 ALL SCHOOL BEHAVIOR CHECKS PASSED' : `\n❌ ${fail} CHECKS FAILED`);
process.exit(fail === 0 ? 0 : 1);

export interface UniversityStarterItem {
  name: string;
  country: string;
  state?: string;
  ranking: number;
  acceptanceRate?: number;
  website?: string;
}

export const UNIVERSITY_STARTER_CATALOG: UniversityStarterItem[] = [
  { name: 'Massachusetts Institute of Technology', country: 'USA', state: 'Massachusetts', ranking: 1, acceptanceRate: 4.0, website: 'https://www.mit.edu' },
  { name: 'Stanford University', country: 'USA', state: 'California', ranking: 2, acceptanceRate: 4.3, website: 'https://www.stanford.edu' },
  { name: 'Harvard University', country: 'USA', state: 'Massachusetts', ranking: 3, acceptanceRate: 3.4, website: 'https://www.harvard.edu' },
  { name: 'University of Oxford', country: 'United Kingdom', ranking: 4, acceptanceRate: 17.5, website: 'https://www.ox.ac.uk' },
  { name: 'University of Cambridge', country: 'United Kingdom', ranking: 5, acceptanceRate: 20.0, website: 'https://www.cam.ac.uk' },
  { name: 'Imperial College London', country: 'United Kingdom', ranking: 6, acceptanceRate: 14.3, website: 'https://www.imperial.ac.uk' },
  { name: 'ETH Zurich', country: 'Switzerland', ranking: 7, acceptanceRate: 27.0, website: 'https://ethz.ch' },
  { name: 'National University of Singapore', country: 'Singapore', ranking: 8, acceptanceRate: 7.0, website: 'https://www.nus.edu.sg' },
  { name: 'University College London', country: 'United Kingdom', ranking: 9, acceptanceRate: 36.0, website: 'https://www.ucl.ac.uk' },
  { name: 'California Institute of Technology', country: 'USA', state: 'California', ranking: 10, acceptanceRate: 2.7, website: 'https://www.caltech.edu' },
  { name: 'University of Pennsylvania', country: 'USA', state: 'Pennsylvania', ranking: 11, acceptanceRate: 5.8, website: 'https://www.upenn.edu' },
  { name: 'Yale University', country: 'USA', state: 'Connecticut', ranking: 12, acceptanceRate: 4.4, website: 'https://www.yale.edu' },
  { name: 'Princeton University', country: 'USA', state: 'New Jersey', ranking: 13, acceptanceRate: 4.0, website: 'https://www.princeton.edu' },
  { name: 'University of Chicago', country: 'USA', state: 'Illinois', ranking: 14, acceptanceRate: 5.4, website: 'https://www.uchicago.edu' },
  { name: 'Tsinghua University', country: 'China', ranking: 15, acceptanceRate: 16.0, website: 'https://www.tsinghua.edu.cn' },
  { name: 'Peking University', country: 'China', ranking: 16, acceptanceRate: 15.0, website: 'https://www.pku.edu.cn' },
  { name: 'Cornell University', country: 'USA', state: 'New York', ranking: 17, acceptanceRate: 7.5, website: 'https://www.cornell.edu' },
  { name: 'Columbia University', country: 'USA', state: 'New York', ranking: 18, acceptanceRate: 3.9, website: 'https://www.columbia.edu' },
  { name: 'University of Toronto', country: 'Canada', state: 'Ontario', ranking: 19, acceptanceRate: 43.0, website: 'https://www.utoronto.ca' },
  { name: 'University of Edinburgh', country: 'United Kingdom', ranking: 20, acceptanceRate: 39.0, website: 'https://www.ed.ac.uk' },
  { name: 'McGill University', country: 'Canada', state: 'Quebec', ranking: 21, acceptanceRate: 46.0, website: 'https://www.mcgill.ca' },
  { name: 'University of Michigan', country: 'USA', state: 'Michigan', ranking: 22, acceptanceRate: 18.0, website: 'https://umich.edu' },
  { name: 'Johns Hopkins University', country: 'USA', state: 'Maryland', ranking: 23, acceptanceRate: 7.7, website: 'https://www.jhu.edu' },
  { name: 'University of California, Berkeley', country: 'USA', state: 'California', ranking: 24, acceptanceRate: 11.3, website: 'https://www.berkeley.edu' },
  { name: 'University of Melbourne', country: 'Australia', state: 'Victoria', ranking: 25, acceptanceRate: 70.0, website: 'https://www.unimelb.edu.au' },
  { name: 'Australian National University', country: 'Australia', state: 'ACT', ranking: 26, acceptanceRate: 35.0, website: 'https://www.anu.edu.au' },
  { name: 'University of Sydney', country: 'Australia', state: 'New South Wales', ranking: 27, acceptanceRate: 30.0, website: 'https://www.sydney.edu.au' },
  { name: 'University of New South Wales', country: 'Australia', state: 'New South Wales', ranking: 28, acceptanceRate: 30.0, website: 'https://www.unsw.edu.au' },
  { name: 'Monash University', country: 'Australia', state: 'Victoria', ranking: 29, acceptanceRate: 40.0, website: 'https://www.monash.edu' },
  { name: 'University of Queensland', country: 'Australia', state: 'Queensland', ranking: 30, acceptanceRate: 40.0, website: 'https://www.uq.edu.au' },
  { name: 'Technical University of Munich', country: 'Germany', state: 'Bavaria', ranking: 31, acceptanceRate: 24.0, website: 'https://www.tum.de' },
  { name: 'LMU Munich', country: 'Germany', state: 'Bavaria', ranking: 32, acceptanceRate: 28.0, website: 'https://www.lmu.de' },
  { name: 'Heidelberg University', country: 'Germany', state: 'Baden-Wurttemberg', ranking: 33, acceptanceRate: 17.0, website: 'https://www.uni-heidelberg.de' },
  { name: 'EPFL', country: 'Switzerland', state: 'Vaud', ranking: 34, acceptanceRate: 30.0, website: 'https://www.epfl.ch' },
  { name: 'KU Leuven', country: 'Belgium', ranking: 35, acceptanceRate: 73.0, website: 'https://www.kuleuven.be' },
  { name: 'University of Amsterdam', country: 'Netherlands', ranking: 36, acceptanceRate: 34.0, website: 'https://www.uva.nl' },
  { name: 'Delft University of Technology', country: 'Netherlands', ranking: 37, acceptanceRate: 65.0, website: 'https://www.tudelft.nl' },
  { name: 'Seoul National University', country: 'South Korea', ranking: 38, acceptanceRate: 16.0, website: 'https://www.snu.ac.kr' },
  { name: 'KAIST', country: 'South Korea', ranking: 39, acceptanceRate: 18.0, website: 'https://www.kaist.ac.kr' },
  { name: 'University of Tokyo', country: 'Japan', ranking: 40, acceptanceRate: 34.0, website: 'https://www.u-tokyo.ac.jp' },
  { name: 'Kyoto University', country: 'Japan', ranking: 41, acceptanceRate: 37.0, website: 'https://www.kyoto-u.ac.jp' },
  { name: 'The University of Hong Kong', country: 'Hong Kong', ranking: 42, acceptanceRate: 22.0, website: 'https://www.hku.hk' },
  { name: 'Nanyang Technological University', country: 'Singapore', ranking: 43, acceptanceRate: 36.0, website: 'https://www.ntu.edu.sg' },
  { name: 'University of Manchester', country: 'United Kingdom', ranking: 44, acceptanceRate: 56.0, website: 'https://www.manchester.ac.uk' },
  { name: 'King\'s College London', country: 'United Kingdom', ranking: 45, acceptanceRate: 13.0, website: 'https://www.kcl.ac.uk' },
  { name: 'University of Bristol', country: 'United Kingdom', ranking: 46, acceptanceRate: 67.0, website: 'https://www.bristol.ac.uk' },
  { name: 'University of Warwick', country: 'United Kingdom', ranking: 47, acceptanceRate: 14.0, website: 'https://warwick.ac.uk' },
  { name: 'University of Glasgow', country: 'United Kingdom', ranking: 48, acceptanceRate: 74.0, website: 'https://www.gla.ac.uk' },
  { name: 'University of Alberta', country: 'Canada', state: 'Alberta', ranking: 49, acceptanceRate: 58.0, website: 'https://www.ualberta.ca' },
  { name: 'University of British Columbia', country: 'Canada', state: 'British Columbia', ranking: 50, acceptanceRate: 52.0, website: 'https://www.ubc.ca' }
];

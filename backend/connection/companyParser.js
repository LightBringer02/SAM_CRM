const axios = require('axios');
const xml2js = require('xml2js');
const { getTallyUrl } = require('../config/systemConfig');

// Get Tally URL from system config (dynamic)
function getActiveTallyUrl() {
  return getTallyUrl() || process.env.TALLY_URL || 'http://localhost:9000';
}

// Cache
let cachedCompanyDetails = null;
let cacheTimestamp = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

// XML request
const COMPANY_DETAILS_XML = `
<ENVELOPE>
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Data</TYPE>
        <ID>CompanyCompleteDetails</ID>
    </HEADER>
    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                <SVCURRENTCOMPANY>Demo_Company</SVCURRENTCOMPANY>
            </STATICVARIABLES>
            <TDL>
                <TDLMESSAGE>
                    <REPORT NAME="CompanyCompleteDetails">
                        <FORMS>CompanyDetailsForm</FORMS>
                    </REPORT>

                    <FORM NAME="CompanyDetailsForm">
                        <PARTS>CompanyDetailsPart</PARTS>
                    </FORM>

                    <PART NAME="CompanyDetailsPart">
                        <LINES>CompanyDetailsLine</LINES>
                        <REPEAT>CompanyDetailsLine : CompanyCollection</REPEAT>
                        <SCROLLED>Vertical</SCROLLED>
                    </PART>

                    <LINE NAME="CompanyDetailsLine">
                        <FIELDS>FldName, FldFormalName, FldGUID, FldAddress, FldGSTIN, FldEmail, FldWebsite, FldMobile, FldPhone, FldFax, FldState, FldPincode, FldCountry</FIELDS>
                    </LINE>

                    <FIELD NAME="FldName"><SET>$Name</SET><XMLTAG>CompanyName</XMLTAG></FIELD>
                    <FIELD NAME="FldFormalName"><SET>$BasicCompanyFormalName</SET><XMLTAG>FormalName</XMLTAG></FIELD>
                    <FIELD NAME="FldGUID"><SET>$GUID</SET><XMLTAG>GUID</XMLTAG></FIELD>
                    <FIELD NAME="FldAddress"><SET>$$CollectionField:$Address:1:Address</SET><XMLTAG>Address</XMLTAG></FIELD>
                    <FIELD NAME="FldGSTIN"><SET>$$CollectionField:$GSTRegistrationDetails:1:GSTIN</SET><XMLTAG>GSTIN</XMLTAG></FIELD>
                    <FIELD NAME="FldEmail"><SET>$Email</SET><XMLTAG>Email</XMLTAG></FIELD>
                    <FIELD NAME="FldWebsite"><SET>$Website</SET><XMLTAG>Website</XMLTAG></FIELD>
                    <FIELD NAME="FldMobile"><SET>$MobileNo</SET><XMLTAG>Mobile</XMLTAG></FIELD>
                    <FIELD NAME="FldPhone"><SET>$TelephoneNo</SET><XMLTAG>Telephone</XMLTAG></FIELD>
                    <FIELD NAME="FldFax"><SET>$FaxNo</SET><XMLTAG>Fax</XMLTAG></FIELD>
                    <FIELD NAME="FldState"><SET>$StateName</SET><XMLTAG>State</XMLTAG></FIELD>
                    <FIELD NAME="FldPincode"><SET>$Pincode</SET><XMLTAG>Pincode</XMLTAG></FIELD>
                    <FIELD NAME="FldCountry"><SET>$CountryName</SET><XMLTAG>Country</XMLTAG></FIELD>

                    <COLLECTION NAME="CompanyCollection">
                        <TYPE>Company</TYPE>
                    </COLLECTION>
                </TDLMESSAGE>
            </TDL>
        </DESC>
    </BODY>
</ENVELOPE>
`;

// Clean invalid XML characters
function cleanTallyXml(xml) {
  return xml.replace(/&#(?:[0-9]|[1-2][0-9]|3[0-1]);/g, '');
}

// Safe getter
function getText(node, key) {
  if (!node) return '';

  if (key) {
    const val = node[key];
    if (!val) return '';
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'number') return String(val);
    if (Array.isArray(val)) return getText(val[0], null);
    if (typeof val === 'object') {
      if (val._) return String(val._).trim();
      if (val['#text']) return String(val['#text']).trim();
      return '';
    }
  }

  if (typeof node === 'string') return node.trim();
  if (typeof node === 'number') return String(node);
  if (node._) return String(node._).trim();
  return '';
}

// Detect company nodes robustly
function findCompanyNodes(node, result = []) {
  if (!node || typeof node !== 'object') return result;

  // Case 1: Raw ENVELOPE with fields (your sample XML)
  if (node.COMPANYNAME && !node.COMPANY) {
    result.push(node);
  }

  // Case 2: Standard Tally Company node
  if (node.COMPANY) {
    const companies = Array.isArray(node.COMPANY) ? node.COMPANY : [node.COMPANY];
    result.push(...companies);
  }

  // Recurse
  for (const key of Object.keys(node)) {
    if (typeof node[key] === 'object') {
      findCompanyNodes(node[key], result);
    }
  }

  return result;
}

// Parse XML → Company objects
async function parseCompanyXml(xml) {
  const parsed = await xml2js.parseStringPromise(xml, {
    explicitArray: true,        // FIXED (same reason as voucher parser)
    mergeAttrs: true,
    preserveChildrenOrder: true
  });

  let companies = findCompanyNodes(parsed);

  // If no structured company found, treat ENVELOPE as company (your raw XML case)
  if (companies.length === 0 && parsed.ENVELOPE) {
    companies = [parsed.ENVELOPE];
  }

  // Fallback root-level
  if (companies.length === 0) {
    companies = [parsed];
  }

  return companies.map(normalizeCompanyDetails).filter(Boolean);
}

// Normalize fields
function normalizeCompanyDetails(company) {
  if (!company) return null;

  const address = getText(company, 'ADDRESS');

  const gstin =
    getText(company, 'GSTIN') ||
    getText(company, 'PARTYGSTIN') ||
    getText(company, 'LEDGERGSTIN') || '';

  return {
    company_name: getText(company, 'COMPANYNAME'),
    formal_name: getText(company, 'FORMALNAME') || getText(company, 'COMPANYNAME'),
    guid: getText(company, 'GUID'),
    address: address || '',
    gstin: gstin,
    state: getText(company, 'STATE'),
    pincode: getText(company, 'PINCODE'),
    country: getText(company, 'COUNTRY'),
    mobile: getText(company, 'MOBILE'),
    email: getText(company, 'EMAIL'),
    website: getText(company, 'WEBSITE'),
    telephone: getText(company, 'TELEPHONE'),
    fax: getText(company, 'FAX'),
    gst_registration_type: getText(company, 'GSTREGISTRATIONTYPE'),
    currency: getText(company, 'CURRENCYNAME')
  };
}

// Fetch from Tally
async function fetchCompanyDetailsFromTally() {
  try {
    const TALLY_URL = getActiveTallyUrl();
    const { data } = await axios.post(TALLY_URL, COMPANY_DETAILS_XML, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 15000
    });

    const cleaned = cleanTallyXml(data);
    const companies = await parseCompanyXml(cleaned);

    return companies.length ? companies[0] : null;
  } catch (err) {
    console.error('Company Details Fetch Error:', err.message);
    throw err;
  }
}

async function getCompanyDetails(forceRefresh = false) {
  const now = Date.now();

  if (!forceRefresh && cachedCompanyDetails && cacheTimestamp && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedCompanyDetails;
  }

  const details = await fetchCompanyDetailsFromTally();
  if (details) {
    cachedCompanyDetails = details;
    cacheTimestamp = now;
  }

  return details;
}

function clearCompanyCache() {
  cachedCompanyDetails = null;
  cacheTimestamp = null;
}

module.exports = {
  getCompanyDetails,
  fetchCompanyDetailsFromTally,
  parseCompanyXml,
  normalizeCompanyDetails,
  clearCompanyCache
};
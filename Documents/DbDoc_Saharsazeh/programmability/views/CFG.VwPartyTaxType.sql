CREATE    VIEW CFG.VwPartyTaxType
AS

SELECT p.PartyID,
       VendorType.Code       VendorTaxType,
       customertype.Code     CustomerTaxType
FROM   cfg.Party          AS p
       LEFT JOIN (
                SELECT ecfd.EntityID,
                       ldi.Code
                FROM   cfg.EntityCustomeFieldData AS ecfd
                       INNER JOIN cfg.EntityCustomeField AS ecf
                            ON  ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
                            AND ecf.FieldName = 'HCForoushandeType1Code'
                       INNER JOIN cfg.LookupDataItem AS ldi
                            ON  ecfd.LookupDataItemID = ldi.LookupDataItemID
            ) VendorType
            ON  p.PartyID = vendortype.EntityID
       LEFT JOIN (
                SELECT ecfd2.EntityID,
                       ldi2.Code
                FROM   cfg.EntityCustomeFieldData AS ecfd2
                       INNER JOIN cfg.EntityCustomeField AS ecf2
                            ON  ecf2.EntityCustomeFieldID = ecfd2.EntityCustomeFieldID
                            AND ecf2.FieldName = 'HCType1Code'
                       INNER JOIN cfg.LookupDataItem AS ldi2
                            ON  ecfd2.LookupDataItemID = ldi2.LookupDataItemID
            ) CustomerType
            ON  p.PartyID = customertype.EntityID
       
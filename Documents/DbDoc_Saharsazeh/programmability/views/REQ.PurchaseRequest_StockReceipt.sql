
-----------Start of #7929
CREATE   VIEW REQ.PurchaseRequest_StockReceipt
AS

---PurchaseRequest.StockReceip
SELECT sri.PurchaseRequestItemID,
       sri.StockReceiptItemID,
       sri.MainQuantity         StockReceiptMainQuantity
FROM   STC.StockReceiptItem  AS sri
WHERE  sri.PurchaseRequestItemID IS NOT NULL
---PurchaseRequest.PurchaseInvoice.StockReceip
UNION
SELECT pii.PurchaseRequestItemID,
       sri.StockReceiptItemID,
       sri.MainQuantity    
FROM   VND.PurchaseInvoiceItem          AS pii
       INNER JOIN STC.StockReceiptItem  AS sri
            ON  sri.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
WHERE  pii.PurchaseRequestItemID IS NOT NULL
---PurchaseRequest.Proposal.PurchaseInvoice.StockReceip    
UNION
SELECT pi1.PurchaseRequestItemID,
       sri.StockReceiptItemID,
       sri.MainQuantity    
FROM   VND.ProposalItem                 AS pi1
       INNER JOIN VND.PurchaseInvoiceItem AS pii
            ON  pii.ProposalItemID = pi1.ProposalItemID
       INNER JOIN STC.StockReceiptItem  AS sri
            ON  sri.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
WHERE  pi1.PurchaseRequestItemID IS NOT NULL
---PurchaseRequest.Proposal.StockReceip        
UNION
SELECT pi1.PurchaseRequestItemID,
       sri.StockReceiptItemID,
       sri.MainQuantity    
FROM   VND.ProposalItem                 AS pi1
       INNER JOIN STC.StockReceiptItem  AS sri
            ON  sri.ProposalItemID = pi1.ProposalItemID
WHERE  pi1.PurchaseRequestItemID IS NOT NULL
---PurchaseRequest.Proposal.TemporaryStockReceipt.JustificationInput.StockReceip        
UNION
SELECT pi1.PurchaseRequestItemID,
       sri.StockReceiptItemID,
       sri.MainQuantity    
FROM   VND.ProposalItem                 AS pi1
       INNER JOIN STC.TemporaryStockReceiptItem AS tsri
            ON  tsri.ProposalItemID = pi1.ProposalItemID
       INNER JOIN STC.JustificationInputItem AS jii
            ON  jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
       INNER JOIN STC.StockReceiptItem  AS sri
            ON  sri.JustificationInputItemID = jii.JustificationInputItemID
WHERE  pi1.PurchaseRequestItemID IS NOT NULL
---PurchaseRequest.JustificationInput.StockReceip            
UNION
SELECT jii.PurchaseRequestItemID,
       sri.StockReceiptItemID,
       sri.MainQuantity        
FROM   STC.JustificationInputItem       AS jii
       INNER JOIN STC.StockReceiptItem  AS sri
            ON  sri.JustificationInputItemID = jii.JustificationInputItemID
WHERE  jii.PurchaseRequestItemID IS NOT NULL
---PurchaseRequest.TemporaryStockReceipt.JustificationInput.StockReceip         
UNION
SELECT tsri.PurchaseRequestItemID,
       sri.StockReceiptItemID,
       sri.MainQuantity    
FROM   STC.TemporaryStockReceiptItem    AS tsri
       INNER JOIN STC.JustificationInputItem AS jii
            ON  jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
       INNER JOIN STC.StockReceiptItem  AS sri
            ON  sri.JustificationInputItemID = jii.JustificationInputItemID
WHERE  tsri.PurchaseRequestItemID IS NOT NULL
---PurchaseRequest.PurchaseContract.StockReceip             
UNION
SELECT pci.PurchaseRequestItemID,
       sri.StockReceiptItemID,
       sri.MainQuantity    
FROM   VND.PurchaseContractItem pci
       JOIN STC.StockReceiptItem sri
            ON  sri.PurchaseContractItemID = pci.PurchaseContractItemID
WHERE  pci.PurchaseRequestItemID IS NOT NULL
---PurchaseRequest.PurchaseContract.PurchaseInvoice.StockReceip         
UNION
SELECT pci.PurchaseRequestItemID,
       sri.StockReceiptItemID,
       sri.MainQuantity            
FROM   VND.PurchaseContractItem pci
       JOIN VND.PurchaseInvoiceItem pii
            ON  pii.PurchaseContractItemID = pci.PurchaseContractItemID
       JOIN STC.StockReceiptItem sri
            ON  sri.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
WHERE  pci.PurchaseRequestItemID IS NOT NULL
---PurchaseRequest.PurchaseContract.JustificationInput.StockReceip         
UNION
SELECT pci.PurchaseRequestItemID,
       sri.StockReceiptItemID,
       sri.MainQuantity            
FROM   VND.PurchaseContractItem pci
       JOIN STC.JustificationInputItem pii
            ON  pii.PurchaseContractItemID = pci.PurchaseContractItemID
       JOIN STC.StockReceiptItem sri
            ON  sri.JustificationInputItemID = pii.JustificationInputItemID
WHERE  pci.PurchaseRequestItemID IS NOT NULL
---PurchaseRequest.PurchaseContract.TemporaryStockReceipt.JustificationInput.StockReceip         
UNION
SELECT pci.PurchaseRequestItemID,
       sri.StockReceiptItemID,
       sri.MainQuantity            
FROM   VND.PurchaseContractItem pci
       JOIN STC.TemporaryStockReceiptItem tsri
            ON  tsri.PurchaseContractItemID = pci.PurchaseContractItemID
       JOIN STC.JustificationInputItem pii
            ON  pii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
       JOIN STC.StockReceiptItem sri
            ON  sri.JustificationInputItemID = pii.JustificationInputItemID
WHERE  pci.PurchaseRequestItemID IS NOT NULL
---PurchaseRequest.Proposal.PurchaseContract.StockReceip             
UNION
SELECT pit.PurchaseRequestItemID,
       sri.StockReceiptItemID,
       sri.MainQuantity            
FROM   VND.ProposalItem pit
       JOIN VND.PurchaseContractItem pci
            ON  pci.ProposalItemID = pit.ProposalItemID
       JOIN STC.StockReceiptItem sri
            ON  sri.PurchaseContractItemID = pci.PurchaseContractItemID
WHERE  pit.PurchaseRequestItemID IS NOT NULL
---PurchaseRequest.Proposal.PurchaseContract.PurchaseInvoice.StockReceip
UNION
SELECT pit.PurchaseRequestItemID,
       sri.StockReceiptItemID,
       sri.MainQuantity            
FROM   VND.ProposalItem pit
       JOIN VND.PurchaseContractItem pci
            ON  pci.ProposalItemID = pit.ProposalItemID
       JOIN VND.PurchaseInvoiceItem pii
            ON  pii.PurchaseContractItemID = pci.PurchaseContractItemID
       JOIN STC.StockReceiptItem sri
            ON  sri.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
WHERE  pit.PurchaseRequestItemID IS NOT NULL
---PurchaseRequest.Proposal.PurchaseContract.JustificationInput.StockReceip    
UNION
SELECT pit.PurchaseRequestItemID,
       sri.StockReceiptItemID,
       sri.MainQuantity            
FROM   VND.ProposalItem pit
       JOIN VND.PurchaseContractItem pci
            ON  pci.ProposalItemID = pit.ProposalItemID
       JOIN STC.JustificationInputItem pii
            ON  pii.PurchaseContractItemID = pci.PurchaseContractItemID
       JOIN STC.StockReceiptItem sri
            ON  sri.JustificationInputItemID = pii.JustificationInputItemID
WHERE  pit.PurchaseRequestItemID IS NOT NULL
---PurchaseRequest.Proposal.PurchaseContract.TemporaryStockReceipt.JustificationInput.StockReceip    
UNION
SELECT pit.PurchaseRequestItemID,
       sri.StockReceiptItemID,
       sri.MainQuantity            
FROM   VND.ProposalItem pit
       JOIN VND.PurchaseContractItem pci
            ON  pci.ProposalItemID = pit.ProposalItemID
       JOIN STC.TemporaryStockReceiptItem tsri
            ON  tsri.PurchaseContractItemID = pci.PurchaseContractItemID
       JOIN STC.JustificationInputItem pii
            ON  pii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
       JOIN STC.StockReceiptItem sri
            ON  sri.JustificationInputItemID = pii.JustificationInputItemID
WHERE  pit.PurchaseRequestItemID IS NOT NULL
---PurchaseRequest.PurchasePlanning.Proposal.PurchaseContract.TemporaryStockReceipt.JustificationInput.StockReceip    
UNION
SELECT ppi.PurchaseRequestItemID,
       sri.StockReceiptItemID,
       sri.MainQuantity            
FROM   vnd.PurchasePlanningItem ppi
       JOIN vnd.ProposalItem PI
            ON  PI.PurchasePlanningItemID = ppi.PurchasePlanningItemID
       JOIN vnd.PurchaseContractItem pci
            ON  pci.ProposalItemID = PI.ProposalItemID
       JOIN stc.TemporaryStockReceiptItem tsri
            ON  tsri.PurchaseContractItemID = pci.PurchaseContractItemID
       JOIN stc.JustificationInputItem jii
            ON  jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
       JOIN stc.StockReceiptItem sri
            ON  sri.JustificationInputItemID = jii.JustificationInputItemID
---PurchaseRequest.PurchaseInvoice.TemporaryStockReceipt.JustificationInput.StockReceip    
UNION
SELECT pii.PurchaseRequestItemID,
       sri.StockReceiptItemID,
       sri.MainQuantity            
FROM   vnd.PurchaseInvoiceItem          AS pii
       JOIN stc.TemporaryStockReceiptItem AS tsri
            ON  tsri.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
       JOIN stc.JustificationInputItem  AS jii
            ON  jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
       JOIN stc.StockReceiptItem        AS sri
            ON  sri.JustificationInputItemID = jii.JustificationInputItemID
--PurchaseRequest.PurchaseContract.PurchaseInvoice.TemporaryStockReceipt.JustificationInput.StockReceip        
UNION
SELECT pci.PurchaseRequestItemID,
       sri.StockReceiptItemID,
       sri.MainQuantity            
FROM   vnd.PurchaseContractItem         AS pci
       JOIN vnd.PurchaseInvoiceItem     AS pii
            ON  pii.PurchaseContractItemID = pci.PurchaseContractItemID
       JOIN stc.TemporaryStockReceiptItem AS tsri
            ON  tsri.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
       JOIN stc.JustificationInputItem  AS jii
            ON  jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
       JOIN stc.StockReceiptItem        AS sri
            ON  jii.JustificationInputItemID = sri.JustificationInputItemID
--PurchaseRequest.PurchaseContract.Proforma.PurchaseInvoice.BillOfLading.tarkhis.StockReceip
UNION 
SELECT pci.PurchaseRequestItemID,
       sri.StockReceiptItemID,
       sri.MainQuantity
FROM   vnd.PurchaseContractItem      AS pci
       JOIN fos.ProformaInvoiceItem  AS pii
            ON  pii.PurchaseContractItemID = pci.PurchaseContractItemID
       JOIN vnd.PurchaseInvoiceItem  AS pii2
            ON  pii2.ProformaInvoiceItemID = pii.ProformaInvoiceItemID
       JOIN fos.BillOfLadingItem     AS boli
            ON  boli.PurchaseInvoiceItemID = pii2.PurchaseInvoiceItemID
       JOIN fos.ClearanceItem        AS ci
            ON  ci.BillOfLadingItemID = boli.BillOfLadingItemID
       JOIN stc.StockReceiptItem     AS sri
            ON  sri.ClearanceItemID = ci.ClearanceItemID
--PurchaseRequest.PurchaseContract.DeliveryJustification.StockReceipt
UNION 
SELECT pci.PurchaseRequestItemID,
       sri.StockReceiptItemID,
       sri.MainQuantity
FROM vnd.PurchaseContractItem  AS pci
       JOIN vnd.DeliveryJustificationItem AS dji
            ON  dji.PurchaseContractItemID = pci.PurchaseContractItemID
       JOIN stc.StockReceiptItem      AS sri
            ON  sri.DeliveryJustificationItemID = dji.DeliveryJustificationItemID
--PurchaseRequest.PurchaseContract.DeliveryJustification.StockReceipt
UNION 
SELECT pci.PurchaseRequestItemID,
       sri.StockReceiptItemID,
       sri.MainQuantity
FROM  vnd.PurchaseContractItem    AS pci
       JOIN vnd.DeliveryJustificationItem AS dji
            ON  dji.PurchaseContractItemID = pci.PurchaseContractItemID
       JOIN stc.TemporaryStockReceiptItem AS tsri
            ON  tsri.DeliveryJustificationItemID = dji.DeliveryJustificationItemID
       JOIN stc.JustificationInputItem  AS jii
            ON  jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
       JOIN stc.StockReceiptItem        AS sri
            ON  jii.JustificationInputItemID = sri.JustificationInputItemID
--PurchaseRequest.PurchaseContract.TemporaryStockReceip.JustificationInput.StockReceipt
UNION 
SELECT pci.PurchaseRequestItemID,sri.StockReceiptItemID,sri.MainQuantity
FROM   vnd.PurchaseContractItem         AS pci
       JOIN stc.TemporaryStockReceiptItem AS tsri
            ON  tsri.PurchaseContractItemID = pci.PurchaseContractItemID
       JOIN stc.JustificationInputItem  AS jii
            ON  jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
       JOIN stc.StockReceiptItem        AS sri
            ON  sri.JustificationInputItemID = jii.JustificationInputItemID
--PurchaseRequest.Proposal.PurchaseInvoice.TemporaryStockReceipt.JustificationInput.StockReceipt
UNION 
SELECT pi1.PurchaseRequestItemID,sri.StockReceiptItemID,sri.MainQuantity
FROM   vnd.ProposalItem                 AS pi1
       JOIN vnd.PurchaseInvoiceItem     AS pii
            ON  pii.ProposalItemID = pi1.ProposalItemID
       JOIN stc.TemporaryStockReceiptItem AS tsri
            ON  tsri.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
       JOIN stc.JustificationInputItem  AS jii
            ON  jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
       JOIN stc.StockReceiptItem        AS sri
            ON  sri.JustificationInputItemID = jii.JustificationInputItemID
--PurchaseContract.Proposal.Proforma.PurchaseInvoice.BillOfLading.Clearance.StockReceipt
UNION 
SELECT pi1.PurchaseRequestItemID,sri.StockReceiptItemID,sri.MainQuantity
FROM   vnd.ProposalItem              AS pi1
       JOIN fos.ProformaInvoiceItem  AS pii
            ON  pii.ProposalItemID = pi1.ProposalItemID
       JOIN vnd.PurchaseInvoiceItem  AS pii2
            ON  pii2.ProformaInvoiceItemID = pii.ProformaInvoiceItemID
       JOIN fos.BillOfLadingItem     AS boli
            ON  boli.PurchaseInvoiceItemID = pii2.PurchaseInvoiceItemID
       JOIN fos.ClearanceItem        AS ci
            ON  ci.BillOfLadingItemID = boli.BillOfLadingItemID
       JOIN stc.StockReceiptItem     AS sri
            ON  sri.ClearanceItemID = ci.ClearanceItemID
--PurchaseContract.Proposal.PurchaseContract.PurchaseInvoice.TemporaryStockReceipt.JustificationInput.StockReceip
UNION 
SELECT pi1.PurchaseRequestItemID,sri.StockReceiptItemID,sri.MainQuantity
FROM   vnd.ProposalItem                 AS pi1
       JOIN vnd.PurchaseContractItem    AS pci
            ON  pci.ProposalItemID = pi1.ProposalItemID
       JOIN vnd.PurchaseInvoiceItem     AS pii
            ON  pii.PurchaseContractItemID = pci.PurchaseContractItemID
       JOIN stc.TemporaryStockReceiptItem AS tsri
            ON  pii.PurchaseInvoiceItemID = tsri.PurchaseInvoiceItemID
       JOIN stc.JustificationInputItem  AS jii
            ON  jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
       JOIN stc.StockReceiptItem        AS sri
            ON  sri.JustificationInputItemID = jii.JustificationInputItemID
--PurchaseRequest.Proposal.PurchaseContract.ProformaInvoice.PurchaseInvoice.BillOfLading.Clearance.StockReceipt
UNION 
SELECT pi1.PurchaseRequestItemID,sri.StockReceiptItemID,sri.MainQuantity
FROM   vnd.ProposalItem               AS pi1
       JOIN vnd.PurchaseContractItem  AS pci
            ON  pci.ProposalItemID = pi1.ProposalItemID
       JOIN fos.ProformaInvoiceItem   AS pii
            ON  pii.PurchaseContractItemID = pci.PurchaseContractItemID
       JOIN vnd.PurchaseInvoiceItem   AS pii2
            ON  pii.ProformaInvoiceItemID = pii2.ProformaInvoiceItemID
       JOIN fos.BillOfLadingItem      AS boli
            ON  boli.PurchaseInvoiceItemID = pii2.PurchaseInvoiceItemID
       JOIN fos.ClearanceItem         AS ci
            ON  ci.BillOfLadingItemID = boli.BillOfLadingItemID
       JOIN stc.StockReceiptItem      AS sri
            ON  ci.ClearanceItemID = sri.ClearanceItemID
--PurchaseRequest.Proposal.PurchaseContract.DeliveryJustification.StockReceipt
UNION 
SELECT pi1.PurchaseRequestItemID,sri.StockReceiptItemID,sri.MainQuantity
FROM   vnd.ProposalItem               AS pi1
       JOIN vnd.PurchaseContractItem  AS pci
            ON  pci.ProposalItemID = pi1.ProposalItemID
       JOIN vnd.DeliveryJustificationItem AS dji
            ON  dji.PurchaseContractItemID = pci.PurchaseContractItemID
       JOIN stc.StockReceiptItem      AS sri
            ON  dji.DeliveryJustificationItemID = sri.DeliveryJustificationItemID
--PurchaseRequest.Proposal.PurchaseContract.DeliveryJustification.TemporaryStockReceipt.JustificationInput.StockReceip
UNION 
SELECT pi1.PurchaseRequestItemID,sri.StockReceiptItemID,sri.MainQuantity
FROM   vnd.ProposalItem                 AS pi1
       JOIN vnd.PurchaseContractItem    AS pci
            ON  pci.ProposalItemID = pi1.ProposalItemID
       JOIN vnd.DeliveryJustificationItem AS dji
            ON  dji.PurchaseContractItemID = pci.PurchaseContractItemID
       JOIN stc.TemporaryStockReceiptItem AS tsri
            ON  dji.DeliveryJustificationItemID = tsri.DeliveryJustificationItemID
       JOIN stc.JustificationInputItem  AS jii
            ON  tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID
       JOIN stc.StockReceiptItem        AS sri
            ON  jii.JustificationInputItemID = sri.JustificationInputItemID
--PurchaseRequest.Proposal.PurchaseContract.TemporaryStockReceipt.JustificationInput.StockReceipt
UNION 
SELECT pi1.PurchaseRequestItemID,sri.StockReceiptItemID,sri.MainQuantity
FROM   vnd.ProposalItem                 AS pi1
       JOIN vnd.PurchaseContractItem    AS pci
            ON  pci.ProposalItemID = pi1.ProposalItemID
       JOIN stc.TemporaryStockReceiptItem AS tsri
            ON  tsri.PurchaseContractItemID = pci.PurchaseContractItemID
       JOIN stc.JustificationInputItem  AS jii
            ON  jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
       JOIN stc.StockReceiptItem        AS sri
            ON  sri.JustificationInputItemID = jii.JustificationInputItemID
--PurchaseRequest.PurchasePlanning.Proposal.StockReceipt
UNION 
SELECT ppi.PurchaseRequestItemID,sri.StockReceiptItemID,sri.MainQuantity
FROM   vnd.PurchasePlanningItem   AS ppi
       JOIN vnd.ProposalItem      AS pi1
            ON  pi1.PurchasePlanningItemID = ppi.PurchasePlanningItemID
       JOIN stc.StockReceiptItem  AS sri
            ON  sri.ProposalItemID = pi1.ProposalItemID
--PurchaseRequest.PurchasePlanning.Proposal.TemporaryStockReceipt.JustificationInput.StockReceipt
UNION 
SELECT ppi.PurchaseRequestItemID,sri.StockReceiptItemID,sri.MainQuantity
FROM   vnd.PurchasePlanningItem         AS ppi
       JOIN vnd.ProposalItem            AS pi1
            ON  pi1.PurchasePlanningItemID = ppi.PurchasePlanningItemID
       JOIN stc.TemporaryStockReceiptItem AS tsri
            ON  tsri.ProposalItemID = pi1.ProposalItemID
       JOIN stc.JustificationInputItem  AS jii
            ON  jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
       JOIN stc.StockReceiptItem        AS sri
            ON  sri.JustificationInputItemID = jii.JustificationInputItemID
--PurchaseRequest.PurchasePlanning.Proposal.PurchaseInvoice.StockReceipt
UNION 
SELECT ppi.PurchaseRequestItemID,sri.StockReceiptItemID,sri.MainQuantity
FROM   vnd.PurchasePlanningItem      AS ppi
       JOIN vnd.ProposalItem         AS pi1
            ON  pi1.PurchasePlanningItemID = ppi.PurchasePlanningItemID
       JOIN vnd.PurchaseInvoiceItem  AS pii
            ON  pii.ProposalItemID = pi1.ProposalItemID
       JOIN stc.StockReceiptItem     AS sri
            ON  pii.PurchaseInvoiceItemID = sri.PurchaseInvoiceItemID
--PurchaseRequest.PurchasePlanning.Proposal.PurchaseInvoice.TemporaryStockReceipt.JustificationInput.StockReceipt
UNION 
SELECT ppi.PurchaseRequestItemID,sri.StockReceiptItemID,sri.MainQuantity
FROM   vnd.PurchasePlanningItem         AS ppi
       JOIN vnd.ProposalItem            AS pi1
            ON  pi1.PurchasePlanningItemID = ppi.PurchasePlanningItemID
       JOIN vnd.PurchaseInvoiceItem     AS pii
            ON  pii.ProposalItemID = pi1.ProposalItemID
       JOIN stc.TemporaryStockReceiptItem AS tsri
            ON  tsri.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
       JOIN stc.JustificationInputItem  AS jii
            ON  jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
       JOIN stc.StockReceiptItem        AS sri
            ON  sri.JustificationInputItemID = jii.JustificationInputItemID
--PurchaseRequest.PurchasePlanning.Proposal.ProformaInvoice.PurchaseInvoice.BillOfLading.Clearance.StockReceipt
UNION 
SELECT ppi.PurchaseRequestItemID,sri.StockReceiptItemID,sri.MainQuantity
FROM   vnd.PurchasePlanningItem      AS ppi
       JOIN vnd.ProposalItem         AS pi1
            ON  pi1.PurchasePlanningItemID = ppi.PurchasePlanningItemID
       JOIN fos.ProformaInvoiceItem  AS pii
            ON  pii.ProposalItemID = pi1.ProposalItemID
       JOIN vnd.PurchaseInvoiceItem  AS pii2
            ON  pii.ProformaInvoiceItemID = pii2.ProformaInvoiceItemID
       JOIN fos.BillOfLadingItem     AS boli
            ON  boli.PurchaseInvoiceItemID = pii2.PurchaseInvoiceItemID
       JOIN fos.ClearanceItem        AS ci
            ON  ci.BillOfLadingItemID = boli.BillOfLadingItemID
       JOIN stc.StockReceiptItem     AS sri
            ON  sri.ClearanceItemID = ci.ClearanceItemID
--PurchaseRequest.PurchasePlanning.Proposal.PurchaseContract.StockReceipt
UNION 
SELECT ppi.PurchaseRequestItemID,sri.StockReceiptItemID,sri.MainQuantity
FROM   vnd.PurchasePlanningItem       AS ppi
       JOIN vnd.ProposalItem          AS pi1
            ON  pi1.PurchasePlanningItemID = ppi.PurchasePlanningItemID
       JOIN vnd.PurchaseContractItem  AS pci
            ON  pci.ProposalItemID = pi1.ProposalItemID
       JOIN stc.StockReceiptItem      AS sri
            ON  sri.PurchaseContractItemID = pci.PurchaseContractItemID
--PurchaseRequest.PurchasePlanning.Proposal.PurchaseContract.PurchaseInvoice.StockReceipt
UNION 
SELECT ppi.PurchaseRequestItemID,sri.StockReceiptItemID,sri.MainQuantity
FROM   vnd.PurchasePlanningItem       AS ppi
       JOIN vnd.ProposalItem          AS pi1
            ON  pi1.PurchasePlanningItemID = ppi.PurchasePlanningItemID
       JOIN vnd.PurchaseContractItem  AS pci
            ON  pci.ProposalItemID = pi1.ProposalItemID
       JOIN vnd.PurchaseInvoiceItem   AS pii
            ON  pii.PurchaseContractItemID = pci.PurchaseContractItemID
       JOIN stc.StockReceiptItem      AS sri
            ON  pii.PurchaseInvoiceItemID = sri.PurchaseInvoiceItemID
--PurchaseRequest.PurchasePlanning.Proposal.PurchaseContract.PurchaseInvoice.TemporaryStockReceipt.JustificationInput.StockReceipt
UNION 
SELECT ppi.PurchaseRequestItemID,sri.StockReceiptItemID,sri.MainQuantity
FROM   vnd.PurchasePlanningItem         AS ppi
       JOIN vnd.ProposalItem            AS pi1
            ON  pi1.PurchasePlanningItemID = ppi.PurchasePlanningItemID
       JOIN vnd.PurchaseContractItem    AS pci
            ON  pci.ProposalItemID = pi1.ProposalItemID
       JOIN vnd.PurchaseInvoiceItem     AS pii
            ON  pii.PurchaseContractItemID = pci.PurchaseContractItemID
       JOIN stc.TemporaryStockReceiptItem AS tsri
            ON  pii.PurchaseInvoiceItemID = tsri.PurchaseInvoiceItemID
       JOIN stc.JustificationInputItem  AS jii
            ON  jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
       JOIN stc.StockReceiptItem        AS sri
            ON  jii.JustificationInputItemID = sri.JustificationInputItemID
--PurchaseRequest.PurchasePlanning.Proposal.PurchaseContract.TemporaryStockReceipt.JustificationInput.StockReceipt
UNION 
SELECT ppi.PurchaseRequestItemID,sri.StockReceiptItemID,sri.MainQuantity
FROM   vnd.PurchasePlanningItem         AS ppi
       JOIN vnd.ProposalItem            AS pi1
            ON  pi1.PurchasePlanningItemID = ppi.PurchasePlanningItemID
       JOIN vnd.PurchaseContractItem    AS pci
            ON  pci.ProposalItemID = pi1.ProposalItemID
       JOIN stc.TemporaryStockReceiptItem AS tsri
            ON  pci.PurchaseContractItemID = tsri.PurchaseContractItemID
       JOIN stc.JustificationInputItem  AS jii
            ON  jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
       JOIN stc.StockReceiptItem        AS sri
            ON  sri.JustificationInputItemID = jii.JustificationInputItemID
--PurchaseRequest.PurchasePlanning.Proposal.PurchaseContract.ProformaInvoice.PurchaseInvoice.BillOfLading.Clearance.StockReceipt
UNION 
SELECT ppi.PurchaseRequestItemID,sri.StockReceiptItemID,sri.MainQuantity
FROM   vnd.PurchasePlanningItem       AS ppi
       JOIN vnd.ProposalItem          AS pi1
            ON  pi1.PurchasePlanningItemID = ppi.PurchasePlanningItemID
       JOIN vnd.PurchaseContractItem  AS pci
            ON  pci.ProposalItemID = pi1.ProposalItemID
       JOIN fos.ProformaInvoiceItem   AS pii
            ON  pii.PurchaseContractItemID = pci.PurchaseContractItemID
       JOIN vnd.PurchaseInvoiceItem   AS pii2
            ON  pii.ProformaInvoiceItemID = pii2.ProformaInvoiceItemID
       JOIN fos.BillOfLadingItem      AS boli
            ON  boli.PurchaseInvoiceItemID = pii2.PurchaseInvoiceItemID
       JOIN fos.ClearanceItem         AS ci
            ON  ci.BillOfLadingItemID = boli.BillOfLadingItemID
       JOIN stc.StockReceiptItem      AS sri
            ON  sri.ClearanceItemID = ci.ClearanceItemID
--PurchaseRequest.PurchasePlanning.Proposal.PurchaseContract.DeliveryJustification.StockReceipt
UNION 
SELECT ppi.PurchaseRequestItemID,sri.StockReceiptItemID,sri.MainQuantity
FROM   vnd.PurchasePlanningItem       AS ppi
       JOIN vnd.ProposalItem          AS pi1
            ON  pi1.PurchasePlanningItemID = ppi.PurchasePlanningItemID
       JOIN vnd.PurchaseContractItem  AS pci
            ON  pci.ProposalItemID = pi1.ProposalItemID
       JOIN vnd.DeliveryJustificationItem AS dji
            ON  dji.PurchaseContractItemID = pci.PurchaseContractItemID
       JOIN stc.StockReceiptItem      AS sri
            ON  sri.DeliveryJustificationItemID = dji.DeliveryJustificationItemID
--PurchaseRequest.PurchasePlanning.Proposal.PurchaseContract.DeliveryJustification.TemporaryStockReceipt.JustificationInput.StockReceipt
UNION 
SELECT ppi.PurchaseRequestItemID,sri.StockReceiptItemID,sri.MainQuantity
FROM   vnd.PurchasePlanningItem         AS ppi
       JOIN vnd.ProposalItem            AS pi1
            ON  pi1.PurchasePlanningItemID = ppi.PurchasePlanningItemID
       JOIN vnd.PurchaseContractItem    AS pci
            ON  pci.ProposalItemID = pi1.ProposalItemID
       JOIN vnd.DeliveryJustificationItem AS dji
            ON  dji.PurchaseContractItemID = pci.PurchaseContractItemID
       JOIN stc.TemporaryStockReceiptItem AS tsri
            ON  dji.DeliveryJustificationItemID = tsri.DeliveryJustificationItemID
       JOIN stc.JustificationInputItem  AS jii
            ON  tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID
       JOIN stc.StockReceiptItem        AS sri
            ON  jii.JustificationInputItemID = sri.JustificationInputItemID
--PurchaseRequest.ProformaInvoice.PurchaseInvoice.BillOfLading.Clearance.StockReceipt
UNION 
SELECT pii.PurchaseRequestItemID,sri.StockReceiptItemID,sri.MainQuantity
FROM   fos.ProformaInvoiceItem       AS pii
       JOIN vnd.PurchaseInvoiceItem  AS pii2
            ON  pii2.ProformaInvoiceItemID = pii.ProformaInvoiceItemID
       JOIN fos.BillOfLadingItem     AS boli
            ON  boli.PurchaseInvoiceItemID = pii2.PurchaseInvoiceItemID
       JOIN fos.ClearanceItem        AS ci
            ON  ci.BillOfLadingItemID = boli.BillOfLadingItemID
       JOIN stc.StockReceiptItem     AS sri
            ON  sri.ClearanceItemID = ci.ClearanceItemID

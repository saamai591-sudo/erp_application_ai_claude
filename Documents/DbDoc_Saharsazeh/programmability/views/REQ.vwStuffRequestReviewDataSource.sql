
------------------------------------- START #7742
CREATE   VIEW [REQ].vwStuffRequestReviewDataSource
as
           ----------- StuffRequest Outgoing
           
           SELECT sri.StuffRequestID,
                  sr.OrganizationUnitID,sr.StuffRequestDate,
                  sr.BranchID,
                  sri.StuffRequestItemID,
                  sri.StuffID,
                  0.0000                 AS PurchaseRequestQuantity,
                  0.00000                AS PurchaseContractQuantity,
                  0.0000                    TemporaryStockReceiptQuantity,
                  0.0000                    StockReceiptQuantity,
                  oi.MainQuantity           OutgoingQuantity,
                  'Outgoing' as Document,
                  oi.OutgoingID as DocumentID,
                  o.Number DocumentNumber,
                  o.[Date] DocumentDate
                  
           FROM   req.StuffRequestItem   AS sri
                  JOIN req.StuffRequest  AS sr
                       ON  sr.StuffRequestID = sri.StuffRequestID
                  JOIN stc.OutgoingItem  AS oi
                       ON  oi.StuffRequestItemID = sri.StuffRequestItemID
                  join stc.Outgoing AS o on o.OutgoingID = oi.OutgoingID     
           UNION ALL
           
           ------PurchaseRequest
           
           SELECT sri.StuffRequestID,
                  sr.OrganizationUnitID,sr.StuffRequestDate,
                  sr.BranchID,
                  sri.StuffRequestItemID,
                  sri.StuffID,
                  pri.MainQuantity       AS PurchaseRequestQuantity,
                  0.00000                AS PurchaseContractQuantity,
                  0.0000                    TemporaryStockReceiptQuantity,
                  0.0000                    StockReceiptQuantity,
                  0                         OutgoingQuantity,
                  'PurchaseRequest' DOCUMENT,
                  pri.PurchaseRequestID as DocumentID,
                  pr.PurchaseRequestNumber DocumentNumber,
                  pr.PurchaseRequestDate DocumentDate
           FROM   req.StuffRequestItem   AS sri
                  JOIN req.StuffRequest  AS sr
                       ON  sr.StuffRequestID = sri.StuffRequestID
                  JOIN req.PurchaseRequestItem AS pri
                       ON  pri.StuffRequestItemID = sri.StuffRequestItemID
                  join req.PurchaseRequest AS pr on pr.PurchaseRequestID = pri.PurchaseRequestID     
           UNION all
           -------------Purchse order
           
           ---1 StuffRequest PurchaseContract
           SELECT sri.StuffRequestID,
                  sr.OrganizationUnitID,sr.StuffRequestDate,
                  sr.BranchID,
                  sri.StuffRequestItemID,
                  sri.StuffID,
                  0                      AS PurchaseRequestQuantity,
                  pci.MainQuantity       AS PurchaseContractQuantity,
                  0.0000                    TemporaryStockReceiptQuantity,
                  0.0000                    StockReceiptQuantity,
                  0                         OutgoingQuantity,
                  'PurchaseOrder' as DOCUMENT,
                  pci.PurchaseContractID DocumentID,
                  pc.Number DocumentNumber,
                  pc.[Date] DocumentDate
           FROM   req.StuffRequestItem   AS sri
                  JOIN req.StuffRequest  AS sr
                       ON  sr.StuffRequestID = sri.StuffRequestID
                  JOIN vnd.PurchaseContractItem AS pci
                       ON  sri.StuffRequestItemID = pci.StuffRequestItemID
                  join vnd.PurchaseContract AS pc on pc.PurchaseContractID = pci.PurchaseContractID     
           
           UNION ALL
           
           ---2 StuffRequest PurchaseRequest  PurchaseContract
           SELECT sri.StuffRequestID,
                  sr.OrganizationUnitID,sr.StuffRequestDate,
                  sr.BranchID,
                  sri.StuffRequestItemID,
                  sri.StuffID,
                  0                      AS PurchaseRequestQuantity,
                  pci.MainQuantity       AS PurchaseContractQuantity,
                  0.0000                    TemporaryStockReceiptQuantity,
                  0.0000                    StockReceiptQuantity,
                  0                         OutgoingQuantity,
                  'PurchaseOrder' as DOCUMENT,
                  pci.PurchaseContractID DocumentID,
                  pc.Number DocumentNumber,
                  pc.[Date] DocumentDate
           FROM   req.StuffRequestItem   AS sri
                  JOIN req.StuffRequest  AS sr
                       ON  sr.StuffRequestID = sri.StuffRequestID
                  JOIN req.PurchaseRequestItem AS pri
                       ON  pri.StuffRequestItemID = sri.StuffRequestItemID
                  JOIN vnd.PurchaseContractItem AS pci
                       ON  pci.PurchaseRequestItemID = pri.PurchaseRequestItemID
                       join vnd.PurchaseContract AS pc on pc.PurchaseContractID = pci.PurchaseContractID 
           
           UNION ALL
           ---3 StuffRequest PurchaseRequest Proposal  PurchaseContract
           SELECT sri.StuffRequestID,
                  sr.OrganizationUnitID,sr.StuffRequestDate,
                  sr.BranchID,
                  sri.StuffRequestItemID,
                  sri.StuffID,
                  0                      AS PurchaseRequestQuantity,
                  pci.MainQuantity       AS PurchaseContractQuantity,
                  0.0000                    TemporaryStockReceiptQuantity,
                  0.0000                    StockReceiptQuantity,
                  0                         OutgoingQuantity,
                  'PurchaseOrder' as DOCUMENT,
                  pci.PurchaseContractID DocumentID,
                  pc.Number DocumentNumber,
                  pc.[Date] DocumentDate
           FROM   req.StuffRequestItem   AS sri
                  JOIN req.StuffRequest  AS sr
                       ON  sr.StuffRequestID = sri.StuffRequestID
                  JOIN req.PurchaseRequestItem AS pri
                       ON  pri.StuffRequestItemID = sri.StuffRequestItemID
                  JOIN vnd.ProposalItem  AS pi1
                       ON  pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
                  JOIN vnd.PurchaseContractItem AS pci
                       ON  pci.ProposalItemID = pi1.ProposalItemID
           join vnd.PurchaseContract AS pc on pc.PurchaseContractID = pci.PurchaseContractID 
           UNION ALL
           
           ---------------TemporaryStockReceipt
           
           ---1 StuffRequest PurchaseRequest TemporaryStockReceipt
           
           SELECT sri.StuffRequestID,
                  sr.OrganizationUnitID,sr.StuffRequestDate,
                  sr.BranchID,
                  sri.StuffRequestItemID,
                  sri.StuffID,
                  0                      AS PurchaseRequestQuantity,
                  0                      AS PurchaseContractQuantity,
                  tsri.MainQuantity         TemporaryStockReceiptQuantity,
                  0.0000                    StockReceiptQuantity,
                  0                         OutgoingQuantity,
                  'TemporaryStockReceipt' as DOCUMENT,
                  tsri.TemporaryStockReceiptID DocumentID,
                  tsr.Number DocumentNumber,
                  tsr.[Date] DocumentDate
           FROM   req.StuffRequestItem   AS sri
                  JOIN req.StuffRequest  AS sr
                       ON  sr.StuffRequestID = sri.StuffRequestID
                  JOIN req.PurchaseRequestItem AS pri
                       ON  pri.StuffRequestItemID = sri.StuffRequestItemID
                  JOIN stc.TemporaryStockReceiptItem AS tsri
                       ON  tsri.PurchaseRequestItemID = pri.PurchaseRequestItemID
                  join stc.TemporaryStockReceipt AS tsr on tsr.TemporaryStockReceiptID = tsri.TemporaryStockReceiptID     
           
           
           UNION ALL
           ---2 StuffRequest PurchaseRequest PurchaseContract  TemporaryStockReceipt
           
           SELECT sri.StuffRequestID,
                  sr.OrganizationUnitID,sr.StuffRequestDate,
                  sr.BranchID,
                  sri.StuffRequestItemID,
                  sri.StuffID,
                  0                      AS PurchaseRequestQuantity,
                  0                      AS PurchaseContractQuantity,
                  tsri.MainQuantity         TemporaryStockReceiptQuantity,
                  0.0000                    StockReceiptQuantity,
                  0                         OutgoingQuantity,
                  'TemporaryStockReceipt' as DOCUMENT,
                  tsri.TemporaryStockReceiptID DocumentID,
                  tsr.Number DocumentNumber,
                  tsr.[Date] DocumentDate
           FROM   req.StuffRequestItem   AS sri
                  JOIN req.StuffRequest  AS sr
                       ON  sr.StuffRequestID = sri.StuffRequestID
                  JOIN vnd.PurchaseContractItem AS pci
                       ON  pci.StuffRequestItemID = sri.StuffRequestItemID
                  JOIN stc.TemporaryStockReceiptItem AS tsri
                       ON  tsri.PurchaseContractItemID = pci.PurchaseContractItemID
                  join stc.TemporaryStockReceipt AS tsr on tsr.TemporaryStockReceiptID = tsri.TemporaryStockReceiptID     
           
           UNION ALL
           ---3 StuffRequest PurchaseRequest PurchaseContract PurchaseInvoice  TemporaryStockReceipt
           
           SELECT sri.StuffRequestID,
                  sr.OrganizationUnitID,sr.StuffRequestDate,
                  sr.BranchID,
                  sri.StuffRequestItemID,
                  sri.StuffID,
                  0                      AS PurchaseRequestQuantity,
                  0                      AS PurchaseContractQuantity,
                  tsri.MainQuantity         TemporaryStockReceiptQuantity,
                  0.0000                    StockReceiptQuantity,
                  0                         OutgoingQuantity,
                  'TemporaryStockReceipt' as DOCUMENT,
                  tsri.TemporaryStockReceiptID DocumentID,
                  tsr.Number DocumentNumber,
                  tsr.[Date] DocumentDate
           FROM   req.StuffRequestItem   AS sri
                  JOIN req.StuffRequest  AS sr
                       ON  sr.StuffRequestID = sri.StuffRequestID
                  JOIN vnd.PurchaseContractItem AS pci
                       ON  pci.StuffRequestItemID = sri.StuffRequestItemID
                  JOIN vnd.PurchaseInvoiceItem AS pii
                       ON  pii.PurchaseContractItemID = pci.PurchaseContractItemID
                  JOIN stc.TemporaryStockReceiptItem AS tsri
                       ON  tsri.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
				  join stc.TemporaryStockReceipt AS tsr on tsr.TemporaryStockReceiptID = tsri.TemporaryStockReceiptID
           UNION ALL
           ---3 StuffRequest PurchaseRequest Proposal PurchaseInvoice  TemporaryStockReceipt
           
           SELECT sri.StuffRequestID,
                  sr.OrganizationUnitID,sr.StuffRequestDate,
                  sr.BranchID,
                  sri.StuffRequestItemID,
                  sri.StuffID,
                  0                      AS PurchaseRequestQuantity,
                  0                      AS PurchaseContractQuantity,
                  tsri.MainQuantity         TemporaryStockReceiptQuantity,
                  0.0000                    StockReceiptQuantity,
                  0                         OutgoingQuantity,
                  'TemporaryStockReceipt' as DOCUMENT,
                  tsri.TemporaryStockReceiptID DocumentID,
                  tsr.Number DocumentNumber,
                  tsr.[Date] DocumentDate
           FROM   req.StuffRequestItem   AS sri
                  JOIN req.StuffRequest  AS sr
                       ON  sr.StuffRequestID = sri.StuffRequestID
                  JOIN req.PurchaseRequestItem AS pri
                       ON  pri.StuffRequestItemID = sri.StuffRequestItemID
                  JOIN vnd.ProposalItem  AS pi1
                       ON  pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
                  JOIN vnd.PurchaseInvoiceItem AS pii
                       ON  pii.ProposalItemID = pi1.ProposalItemID
                  JOIN stc.TemporaryStockReceiptItem AS tsri
                       ON  tsri.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
                  join stc.TemporaryStockReceipt AS tsr on tsr.TemporaryStockReceiptID = tsri.TemporaryStockReceiptID     
           
           UNION ALL
           ---4 StuffRequest PurchaseRequest Proposal   TemporaryStockReceipt
           
           SELECT sri.StuffRequestID,
                  sr.OrganizationUnitID,sr.StuffRequestDate,
                  sr.BranchID,
                  sri.StuffRequestItemID,
                  sri.StuffID,
                  0                      AS PurchaseRequestQuantity,
                  0                      AS PurchaseContractQuantity,
                  tsri.MainQuantity         TemporaryStockReceiptQuantity,
                  0.0000                    StockReceiptQuantity,
                  0                         OutgoingQuantity,
                  'TemporaryStockReceipt' as DOCUMENT,
                  tsri.TemporaryStockReceiptID DocumentID,
                  tsr.Number DocumentNumber,
                  tsr.[Date] DocumentDate
           FROM   req.StuffRequestItem   AS sri
                  JOIN req.StuffRequest  AS sr
                       ON  sr.StuffRequestID = sri.StuffRequestID
                  JOIN req.PurchaseRequestItem AS pri
                       ON  pri.StuffRequestItemID = sri.StuffRequestItemID
                  JOIN vnd.ProposalItem  AS pi1
                       ON  pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
                  JOIN stc.TemporaryStockReceiptItem AS tsri
                       ON  pi1.ProposalItemID = tsri.ProposalItemID
                       join stc.TemporaryStockReceipt AS tsr on tsr.TemporaryStockReceiptID = tsri.TemporaryStockReceiptID
           
           UNION ALL
           ---5 StuffRequest PurchaseRequest PurchaseOrder DeliveryJustification TemporaryStockReceipt
           
           SELECT sri.StuffRequestID,
                  sr.OrganizationUnitID,sr.StuffRequestDate,
                  sr.BranchID,
                  sri.StuffRequestItemID,
                  sri.StuffID,
                  0                      AS PurchaseRequestQuantity,
                  0                      AS PurchaseContractQuantity,
                  tsri.MainQuantity         TemporaryStockReceiptQuantity,
                  0.0000                    StockReceiptQuantity,
                  0                         OutgoingQuantity,
                  'TemporaryStockReceipt' as DOCUMENT,
                  tsri.TemporaryStockReceiptID DocumentID,
                  tsr.Number DocumentNumber,
                  tsr.[Date] DocumentDate
           FROM   req.StuffRequestItem   AS sri
                  JOIN req.StuffRequest  AS sr
                       ON  sr.StuffRequestID = sri.StuffRequestID
                  JOIN req.PurchaseRequestItem AS pri
                       ON  pri.StuffRequestItemID = sri.StuffRequestItemID
                  JOIN vnd.PurchaseContractItem AS pci
                       ON  pci.PurchaseRequestItemID = pri.PurchaseRequestItemID
                  JOIN vnd.DeliveryJustificationItem AS dji
                       ON  dji.PurchaseContractItemID = pci.PurchaseContractItemID
                  JOIN stc.TemporaryStockReceiptItem AS tsri
                       ON  tsri.DeliveryJustificationItemID = dji.DeliveryJustificationItemID
                  join stc.TemporaryStockReceipt AS tsr on tsr.TemporaryStockReceiptID = tsri.TemporaryStockReceiptID     
           
           UNION ALL
           
           ---------------StockReceipt
           
           ---1 StuffRequest PurchaseRequest StockReceipt
           
           SELECT sri.StuffRequestID,
                  sr.OrganizationUnitID,sr.StuffRequestDate,
                  sr.BranchID,
                  sri.StuffRequestItemID,
                  sri.StuffID,
                  0                      AS PurchaseRequestQuantity,
                  0                      AS PurchaseContractQuantity,
                  0                         TemporaryStockReceiptQuantity,
                  sri2.MainQuantity         StockReceiptQuantity,
                  0                         OutgoingQuantity,
                  'StockReceipt' as DOCUMENT,
                  sri2.StockReceiptID DocumentID,
                  sr2.Number DocumentNumber,
                  sr2.[Date] DocumentDate
           FROM   req.StuffRequestItem   AS sri
                  JOIN req.StuffRequest  AS sr
                       ON  sr.StuffRequestID = sri.StuffRequestID
                  JOIN req.PurchaseRequestItem AS pri
                       ON  pri.StuffRequestItemID = sri.StuffRequestItemID
                  JOIN stc.StockReceiptItem AS sri2
                       ON  sri2.PurchaseRequestItemID = pri.PurchaseRequestItemID
                  JOIN stc.StockReceipt AS sr2 on sr2.StockReceiptID = sri2.StockReceiptID     
           
           UNION ALL
           ---2 StuffRequest PurchaseRequest Proposal StockReceipt
           
           SELECT sri.StuffRequestID,
                  sr.OrganizationUnitID,sr.StuffRequestDate,
                  sr.BranchID,
                  sri.StuffRequestItemID,
                  sri.StuffID,
                  0                      AS PurchaseRequestQuantity,
                  0                      AS PurchaseContractQuantity,
                  0                         TemporaryStockReceiptQuantity,
                  sri2.MainQuantity         StockReceiptQuantity,
                  0                         OutgoingQuantity,
                  'StockReceipt' as DOCUMENT,
                  sri2.StockReceiptID DocumentID,
                  sr2.Number DocumentNumber,
                  sr2.[Date] DocumentDate
           FROM   req.StuffRequestItem   AS sri
                  JOIN req.StuffRequest  AS sr
                       ON  sr.StuffRequestID = sri.StuffRequestID
                  JOIN req.PurchaseRequestItem AS pri
                       ON  pri.StuffRequestItemID = sri.StuffRequestItemID
                  JOIN vnd.ProposalItem  AS pi1
                       ON  pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
                  JOIN stc.StockReceiptItem AS sri2
                       ON  sri2.ProposalItemID = pi1.ProposalItemID
                  JOIN stc.StockReceipt AS sr2 on sr2.StockReceiptID = sri2.StockReceiptID        
           
           UNION ALL
           ---3 StuffRequest PurchaseRequest PurchaseContract StockReceipt
           
           SELECT sri.StuffRequestID,
                  sr.OrganizationUnitID,sr.StuffRequestDate,
                  sr.BranchID,
                  sri.StuffRequestItemID,
                  sri.StuffID,
                  0                      AS PurchaseRequestQuantity,
                  0                      AS PurchaseContractQuantity,
                  0                         TemporaryStockReceiptQuantity,
                  sri2.MainQuantity         StockReceiptQuantity,
                  0                         OutgoingQuantity,
                  'StockReceipt' as DOCUMENT,
                  sri2.StockReceiptID DocumentID,
                  sr2.Number DocumentNumber,
                  sr2.[Date] DocumentDate
           FROM   req.StuffRequestItem   AS sri
                  JOIN req.StuffRequest  AS sr
                       ON  sr.StuffRequestID = sri.StuffRequestID
                  JOIN req.PurchaseRequestItem AS pri
                       ON  pri.StuffRequestItemID = sri.StuffRequestItemID
                  JOIN vnd.PurchaseContractItem AS pci
                       ON  pci.PurchaseRequestItemID = pri.PurchaseRequestItemID
                  JOIN stc.StockReceiptItem AS sri2
                       ON  sri2.PurchaseContractItemID = pci.PurchaseContractItemID
                  JOIN stc.StockReceipt AS sr2 on sr2.StockReceiptID = sri2.StockReceiptID        
           
           UNION ALL
           ---4 StuffRequest PurchaseRequest PurchaseContract StockReceipt
           
           SELECT sri.StuffRequestID,
                  sr.OrganizationUnitID,sr.StuffRequestDate,
                  sr.BranchID,
                  sri.StuffRequestItemID,
                  sri.StuffID,
                  0                      AS PurchaseRequestQuantity,
                  0                      AS PurchaseContractQuantity,
                  0                         TemporaryStockReceiptQuantity,
                  sri2.MainQuantity         StockReceiptQuantity,
                  0                         OutgoingQuantity,
                  'StockReceipt' as DOCUMENT,
                  sri2.StockReceiptID DocumentID,
                  sr2.Number DocumentNumber,
                  sr2.[Date] DocumentDate
           FROM   req.StuffRequestItem   AS sri
                  JOIN req.StuffRequest  AS sr
                       ON  sr.StuffRequestID = sri.StuffRequestID
                  JOIN req.PurchaseRequestItem AS pri
                       ON  pri.StuffRequestItemID = sri.StuffRequestItemID
                  JOIN vnd.PurchaseContractItem AS pci
                       ON  pci.PurchaseRequestItemID = pri.PurchaseRequestItemID
                  JOIN vnd.DeliveryJustificationItem AS dji
                       ON  dji.PurchaseContractItemID = pci.PurchaseContractItemID
                  JOIN stc.StockReceiptItem AS sri2
                       ON  sri2.DeliveryJustificationItemID = dji.DeliveryJustificationItemID
				  JOIN stc.StockReceipt AS sr2 on sr2.StockReceiptID = sri2.StockReceiptID   	 
           
           UNION ALL
           ---5 StuffRequest PurchaseRequest PurchaseContract PurchaseInvoice StockReceipt
           
           SELECT sri.StuffRequestID,
                  sr.OrganizationUnitID,sr.StuffRequestDate,
                  sr.BranchID,
                  sri.StuffRequestItemID,
                  sri.StuffID,
                  0                      AS PurchaseRequestQuantity,
                  0                      AS PurchaseContractQuantity,
                  0                         TemporaryStockReceiptQuantity,
                  sri2.MainQuantity         StockReceiptQuantity,
                  0                         OutgoingQuantity,
                  'StockReceipt' as DOCUMENT,
                  sri2.StockReceiptID DocumentID,
                  sr2.Number DocumentNumber,
                  sr2.[Date] DocumentDate
           FROM   req.StuffRequestItem   AS sri
                  JOIN req.StuffRequest  AS sr
                       ON  sr.StuffRequestID = sri.StuffRequestID
                  JOIN req.PurchaseRequestItem AS pri
                       ON  pri.StuffRequestItemID = sri.StuffRequestItemID
                  JOIN vnd.PurchaseContractItem AS pci
                       ON  pci.PurchaseRequestItemID = pri.PurchaseRequestItemID
                  JOIN vnd.PurchaseInvoiceItem AS pii
                       ON  pii.PurchaseContractItemID = pci.PurchaseContractItemID
                  JOIN stc.StockReceiptItem AS sri2
                       ON  pii.PurchaseInvoiceItemID = sri2.PurchaseInvoiceItemID
                  JOIN stc.StockReceipt AS sr2 on sr2.StockReceiptID = sri2.StockReceiptID        
           
           UNION ALL
           --- 6  StuffRequest PurchaseRequest Proposal  PurchaseInvoice StockReceipt
           
           SELECT sri.StuffRequestID,
                  sr.OrganizationUnitID,sr.StuffRequestDate,
                  sr.BranchID,
                  sri.StuffRequestItemID,
                  sri.StuffID,
                  0                      AS PurchaseRequestQuantity,
                  0                      AS PurchaseContractQuantity,
                  0                         TemporaryStockReceiptQuantity,
                  sri2.MainQuantity         StockReceiptQuantity,
                  0                         OutgoingQuantity,
                  'StockReceipt' as DOCUMENT,
                  sri2.StockReceiptID DocumentID,
                  sr2.Number DocumentNumber,
                  sr2.[Date] DocumentDate
           FROM   req.StuffRequestItem   AS sri
                  JOIN req.StuffRequest  AS sr
                       ON  sr.StuffRequestID = sri.StuffRequestID
                  JOIN req.PurchaseRequestItem AS pri
                       ON  pri.StuffRequestItemID = sri.StuffRequestItemID
                  JOIN vnd.ProposalItem  AS pi1
                       ON  pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
                  JOIN vnd.PurchaseInvoiceItem AS pii
                       ON  pii.ProposalItemID = pi1.ProposalItemID
                  JOIN stc.StockReceiptItem AS sri2
                       ON  pii.PurchaseInvoiceItemID = sri2.PurchaseInvoiceItemID
                  JOIN stc.StockReceipt AS sr2 on sr2.StockReceiptID = sri2.StockReceiptID        
           
           UNION ALL
           
           ---1 StuffRequest PurchaseRequest TemporaryStockReceipt JustificationInput StockReceipt
           
           SELECT sri.StuffRequestID,
                  sr.OrganizationUnitID,sr.StuffRequestDate,
                  sr.BranchID,
                  sri.StuffRequestItemID,
                  sri.StuffID,
                  0                      AS PurchaseRequestQuantity,
                  0                      AS PurchaseContractQuantity,
                  0                         TemporaryStockReceiptQuantity,
                  sri2.MainQuantity         StockReceiptQuantity,
                  0                         OutgoingQuantity,
                  'StockReceipt' as DOCUMENT,
                  sri2.StockReceiptID DocumentID,
                  sr2.Number DocumentNumber,
                  sr2.[Date] DocumentDate
           FROM   req.StuffRequestItem   AS sri
                  JOIN req.StuffRequest  AS sr
                       ON  sr.StuffRequestID = sri.StuffRequestID
                  JOIN req.PurchaseRequestItem AS pri
                       ON  pri.StuffRequestItemID = sri.StuffRequestItemID
                  JOIN stc.TemporaryStockReceiptItem AS tsri
                       ON  tsri.PurchaseRequestItemID = pri.PurchaseRequestItemID
                  JOIN stc.JustificationInputItem AS jii
                       ON  jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
                  JOIN stc.StockReceiptItem AS sri2
                       ON  sri2.JustificationInputItemID = jii.JustificationInputItemID
                  JOIN stc.StockReceipt AS sr2 on sr2.StockReceiptID = sri2.StockReceiptID        
           
           
           UNION ALL
           ---2 StuffRequest PurchaseRequest PurchaseContract  TemporaryStockReceipt JustificationInput StockReceipt
           
           SELECT sri.StuffRequestID,
                  sr.OrganizationUnitID,sr.StuffRequestDate,
                  sr.BranchID,
                  sri.StuffRequestItemID,
                  sri.StuffID,
                  0                      AS PurchaseRequestQuantity,
                  0                      AS PurchaseContractQuantity,
                  0                         TemporaryStockReceiptQuantity,
                  sri2.MainQuantity         StockReceiptQuantity,
                  0                         OutgoingQuantity,
                  'StockReceipt' as DOCUMENT,
                  sri2.StockReceiptID DocumentID,
                  sr2.Number DocumentNumber,
                  sr2.[Date] DocumentDate
           FROM   req.StuffRequestItem   AS sri
                  JOIN req.StuffRequest  AS sr
                       ON  sr.StuffRequestID = sri.StuffRequestID
                  JOIN vnd.PurchaseContractItem AS pci
                       ON  pci.StuffRequestItemID = sri.StuffRequestItemID
                  JOIN stc.TemporaryStockReceiptItem AS tsri
                       ON  tsri.PurchaseContractItemID = pci.PurchaseContractItemID
                  JOIN stc.JustificationInputItem AS jii
                       ON  jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
                  JOIN stc.StockReceiptItem AS sri2
                       ON  sri2.JustificationInputItemID = jii.JustificationInputItemID
                  JOIN stc.StockReceipt AS sr2 on sr2.StockReceiptID = sri2.StockReceiptID        
           
           UNION ALL
           ---3 StuffRequest PurchaseRequest PurchaseContract PurchaseInvoice  TemporaryStockReceipt  JustificationInput StockReceipt
           
           
           SELECT sri.StuffRequestID,
                  sr.OrganizationUnitID,sr.StuffRequestDate,
                  sr.BranchID,
                  sri.StuffRequestItemID,
                  sri.StuffID,
                  0                      AS PurchaseRequestQuantity,
                  0                      AS PurchaseContractQuantity,
                  0                         TemporaryStockReceiptQuantity,
                  sri2.MainQuantity         StockReceiptQuantity,
                  0                         OutgoingQuantity,
                  'StockReceipt' as DOCUMENT,
                  sri2.StockReceiptID DocumentID,
                  sr2.Number DocumentNumber,
                  sr2.[Date] DocumentDate
           FROM   req.StuffRequestItem   AS sri
                  JOIN req.StuffRequest  AS sr
                       ON  sr.StuffRequestID = sri.StuffRequestID
                  JOIN vnd.PurchaseContractItem AS pci
                       ON  pci.StuffRequestItemID = sri.StuffRequestItemID
                  JOIN vnd.PurchaseInvoiceItem AS pii
                       ON  pii.PurchaseContractItemID = pci.PurchaseContractItemID
                  JOIN stc.TemporaryStockReceiptItem AS tsri
                       ON  tsri.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
                  JOIN stc.JustificationInputItem AS jii
                       ON  jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
                  JOIN stc.StockReceiptItem AS sri2
                       ON  sri2.JustificationInputItemID = jii.JustificationInputItemID
                  JOIN stc.StockReceipt AS sr2 on sr2.StockReceiptID = sri2.StockReceiptID        
           
           UNION ALL
           ---3 StuffRequest PurchaseRequest Proposal PurchaseInvoice  TemporaryStockReceipt  JustificationInput StockReceipt
           
           
           SELECT sri.StuffRequestID,
                  sr.OrganizationUnitID,sr.StuffRequestDate,
                  sr.BranchID,
                  sri.StuffRequestItemID,
                  sri.StuffID,
                  0                      AS PurchaseRequestQuantity,
                  0                      AS PurchaseContractQuantity,
                  0                         TemporaryStockReceiptQuantity,
                  sri2.MainQuantity         StockReceiptQuantity,
                  0                         OutgoingQuantity,
                  'StockReceipt' as DOCUMENT,
                  sri2.StockReceiptID DocumentID,
                  sr2.Number DocumentNumber,
                  sr2.[Date] DocumentDate
           FROM   req.StuffRequestItem   AS sri
                  JOIN req.StuffRequest  AS sr
                       ON  sr.StuffRequestID = sri.StuffRequestID
                  JOIN req.PurchaseRequestItem AS pri
                       ON  pri.StuffRequestItemID = sri.StuffRequestItemID
                  JOIN vnd.ProposalItem  AS pi1
                       ON  pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
                  JOIN vnd.PurchaseInvoiceItem AS pii
                       ON  pii.ProposalItemID = pi1.ProposalItemID
                  JOIN stc.TemporaryStockReceiptItem AS tsri
                       ON  tsri.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
                  JOIN stc.JustificationInputItem AS jii
                       ON  jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
                  JOIN stc.StockReceiptItem AS sri2
                       ON  sri2.JustificationInputItemID = jii.JustificationInputItemID
                  JOIN stc.StockReceipt AS sr2 on sr2.StockReceiptID = sri2.StockReceiptID        
           
           UNION ALL
           ---4 StuffRequest PurchaseRequest Proposal   TemporaryStockReceipt  JustificationInput StockReceipt
           
           SELECT sri.StuffRequestID,
                  sr.OrganizationUnitID,sr.StuffRequestDate,
                  sr.BranchID,
                  sri.StuffRequestItemID,
                  sri.StuffID,
                  0                      AS PurchaseRequestQuantity,
                  0                      AS PurchaseContractQuantity,
                  0                         TemporaryStockReceiptQuantity,
                  sri2.MainQuantity         StockReceiptQuantity,
                  0                         OutgoingQuantity,
                  'StockReceipt' as DOCUMENT,
                  sri2.StockReceiptID DocumentID,
                  sr2.Number DocumentNumber,
                  sr2.[Date] DocumentDate
           FROM   req.StuffRequestItem   AS sri
                  JOIN req.StuffRequest  AS sr
                       ON  sr.StuffRequestID = sri.StuffRequestID
                  JOIN req.PurchaseRequestItem AS pri
                       ON  pri.StuffRequestItemID = sri.StuffRequestItemID
                  JOIN vnd.ProposalItem  AS pi1
                       ON  pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
                  JOIN stc.TemporaryStockReceiptItem AS tsri
                       ON  pi1.ProposalItemID = tsri.ProposalItemID
                  JOIN stc.JustificationInputItem AS jii
                       ON  jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
                  JOIN stc.StockReceiptItem AS sri2
                       ON  sri2.JustificationInputItemID = jii.JustificationInputItemID
                  JOIN stc.StockReceipt AS sr2 on sr2.StockReceiptID = sri2.StockReceiptID        
           
           UNION ALL
           ---5 StuffRequest PurchaseRequest PurchaseOrder DeliveryJustification TemporaryStockReceipt  JustificationInput StockReceipt
           SELECT sri.StuffRequestID,
                  sr.OrganizationUnitID,sr.StuffRequestDate,
                  sr.BranchID,
                  sri.StuffRequestItemID,
                  sri.StuffID,
                  0                      AS PurchaseRequestQuantity,
                  0                      AS PurchaseContractQuantity,
                  0                         TemporaryStockReceiptQuantity,
                  sri2.MainQuantity         StockReceiptQuantity,
                  0                         OutgoingQuantity,
                  'StockReceipt' as DOCUMENT,
                  sri2.StockReceiptID DocumentID,
                  sr2.Number DocumentNumber,
                  sr2.[Date] DocumentDate
           FROM   req.StuffRequestItem   AS sri
                  JOIN req.StuffRequest  AS sr
                       ON  sr.StuffRequestID = sri.StuffRequestID
                  JOIN req.PurchaseRequestItem AS pri
                       ON  pri.StuffRequestItemID = sri.StuffRequestItemID
                  JOIN vnd.PurchaseContractItem AS pci
                       ON  pci.PurchaseRequestItemID = pri.PurchaseRequestItemID
                  JOIN vnd.DeliveryJustificationItem AS dji
                       ON  dji.PurchaseContractItemID = pci.PurchaseContractItemID
                  JOIN stc.TemporaryStockReceiptItem AS tsri
                       ON  tsri.DeliveryJustificationItemID = dji.DeliveryJustificationItemID
                  JOIN stc.JustificationInputItem AS jii
                       ON  jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
                  JOIN stc.StockReceiptItem AS sri2
                       ON  sri2.JustificationInputItemID = jii.JustificationInputItemID
                  JOIN stc.StockReceipt AS sr2 on sr2.StockReceiptID = sri2.StockReceiptID        

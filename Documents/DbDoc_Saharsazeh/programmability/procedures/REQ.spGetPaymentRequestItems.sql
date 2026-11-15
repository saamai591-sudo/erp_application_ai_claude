------------------------------------- START #7447
CREATE   PROC REQ.spGetPaymentRequestItems
(
	@PaymentRequestID int
)
--WITH ENCRYPTION
as

	declare @user int,
			@Culture VARCHAR(5),
			@CultureNo tinyint	   			

	set @user = cfg.GetuserID()
	set @Culture = cfg.GetuserCulture()

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

	select i.PaymentRequestItemID,
           i.PaymentRequestID,
           i.RowIndex,
           i.BaseDocumentType,
           i.BaseDocumentID,
		   case i.BaseDocumentType
				when 2 then case when p.InvoiceNumber is not null then p.InvoiceNumber else CAST(p.Number as NVARCHAR(256)) end
				when 3 then CAST(rsi.Number as NVARCHAR(256))
				when 4 then CAST(c.Number as NVARCHAR(256)) 
				when 5 then CAST(cs.Number as NVARCHAR(256)) 
				when 6 then case when csi.ConfirmStatementID is not null then CAST(csi2.Number as NVARCHAR(256)) else isnull(pi.InvoiceNumber,pi.Number) end
				when 7 then CAST(ct.Number as NVARCHAR(256)) 
				when 8 then CAST(pr.Number as NVARCHAR(256)) 
				when 9 THEN CASE WHEN pc.InvoiceNumber is not null THEN pc.InvoiceNumber ELSE CAST(pc.Number AS NVARCHAR(256)) END
				when 10 then d2.Code
				WHEN 11 THEN CAST(cpi.Number AS NVARCHAR(100))
				WHEN 12 THEN 
					CASE 
						WHEN pi2.InvoiceNumber is not null THEN pi2.InvoiceNumber 
						ELSE CAST(pi2.Number AS NVARCHAR(100)) 
					END
				WHEN 13 THEN 
					CASE 
						WHEN pi3.InvoiceNumber IS NOT NULL THEN pi3.InvoiceNumber
						ELSE CAST(pi3.Number AS NVARCHAR(100)) 
					END
				ELSE null
		   END AS BaseDocumentNumber,
		   i.CurrencyID,
		   case @CultureNo
				when 2 then cu.Title2
				else cu.Title
		   end as CurrencyTitle,
		   i.Amount,
		   i.Description,
		   i.Description2,
		   i.Creator,
		   i.CreationDate,
		   i.Version,
		   i.PartyID,
		   pa.Title + ' ' + IsNull(Pa.LastName,'') as PartyName,
		   d.Code PartyCode,
		   i.PartyAccountID, 
		   CASE WHEN  pac.AccountNumber IS NOT NULL THEN pac.AccountNumber
			    WHEN  pac.IBAN IS NOT NULL THEN pac.IBAN
			    ELSE pac.CardNumber	
		   END AS PartyAccountNumber
	FROM REQ.PaymentRequestItem i
		JOIN REQ.PaymentRequest r on r.PaymentRequestID = i.PaymentRequestID
		JOIN CFG.Currency cu on i.CurrencyID = cu.CurrencyID
		JOIN CFG.Party pa on pa.PartyID = i.PartyID
		JOIN ACC.Dl d on pa.DlID = d.DLID
		LEFT JOIN CFG.PartyAccount pac on pac.PartyAccountID = i.PartyAccountID
		LEFT JOIN VND.PurchaseInvoice p on i.BaseDocumentID = p.PurchaseInvoiceID AND i.BaseDocumentType = 2
		LEFT JOIN SLE.ReturnedSaleInvoice rsi on i.BaseDocumentID = rsi.ReturnedSaleInvoiceID AND i.BaseDocumentType = 3
		LEFT JOIN CNT.ConfirmStatement c on i.BaseDocumentID = c.ConfirmStatementID AND i.BaseDocumentType = 4
		LEFT JOIN (select a.ContractStatementID,b.Number
			FROM CNT.ContractStatement a
			JOIN CNT.ConfirmStatement b
				ON a.ContractStatementID = b.ContractStatementID
			) cs on i.BaseDocumentID = cs.ContractStatementID AND i.BaseDocumentType = 5
		LEFT JOIN CNT.ConfirmStatementItem csi on i.BaseDocumentID = csi.ConfirmStatementItemID AND i.BaseDocumentType = 6
		LEFT JOIN CNT.ConfirmStatement csi2 on csi.ConfirmStatementID = csi2.ConfirmStatementID
		LEFT JOIN vnd.PurchaseInvoice pi on pi.PurchaseInvoiceID = csi.PurchaseInvoiceID
		LEFT JOIN cnt.[Contract] ct on i.BaseDocumentID = ct.ContractID AND i.BaseDocumentType = 7
		LEFT JOIN VND.Proposal pr on i.BaseDocumentID = pr.ProposalID AND i.BaseDocumentType = 8	
		LEFT JOIN VND.PurchaseContract pc on i.BaseDocumentID = pc.PurchaseContractID AND i.BaseDocumentType = 9
		LEFT JOIN FIN.PettyCash ptc ON i.BaseDocumentID = ptc.PettyCashID AND i.BaseDocumentType = 10
		LEFT JOIN FIN.Fund fnd ON ptc.FundID = fnd.FundID
		LEFT JOIN ACC.Dl d2 on d2.DLID = fnd.DlID
		LEFT JOIN VND.ConfirmPurchaseInvoice cpi 
			ON i.BaseDocumentID = cpi.ConfirmPurchaseInvoiceID AND i.BaseDocumentType = 11
			AND cpi.ConfirmPurchaseInvoiceStatus = 2
		LEFT JOIN VND.VWConfirmPurchaseInvoiceNonePayment vcpinp 
			ON cpi.ConfirmPurchaseInvoiceID = vcpinp.ConfirmPurchaseInvoiceID 
			AND vcpinp.NonPayment > 0 
		LEFT JOIN CFG.Party pa1 
			ON i.PartyID = pa1.PartyID
		LEFT JOIN VND.PurchaseInvoice pi1 
			ON pi1.PurchaseInvoiceID = cpi.PurchaseInvoiceID 
			AND pa1.DlID = pi1.DlID 
			AND pi1.BranchID = r.BranchID
		LEFT JOIN CFG.Party pa2 
			ON i.PartyID = pa2.PartyID 
		LEFT JOIN VND.PurchaseInvoice pi2
			ON i.BaseDocumentID = pi2.PurchaseInvoiceID AND i.BaseDocumentType = 12
			AND pi2.DlID = pa2.DlID 
			AND pi2.Status = 2
			AND pi2.BranchID = r.BranchID
		LEFT JOIN  VND.PurchaseInvoice_NonPaymented pinp
			ON pi2.PurchaseInvoiceID = pinp.PurchaseInvoiceID AND pinp.NonPaymented > 0
		LEFT JOIN VND.PurchaseType pt
			ON pt.PurchaseTypeID = pi2.Type
			AND pt.HasConfirmStatement = 1
		LEFT JOIN VND.ConfirmPurchaseInvoiceItem cpii 
			ON i.BaseDocumentID = cpii.ConfirmPurchaseInvoiceItemID AND i.BaseDocumentType = 13
		LEFT JOIN VND.ConfirmPurchaseInvoice cpi1 
			ON cpii.ConfirmPurchaseInvoiceID = cpi1.ConfirmPurchaseInvoiceID
			AND cpi1.ConfirmPurchaseInvoiceStatus = 2
		LEFT JOIN CFG.Party pa3 
			ON i.PartyID = pa3.PartyID 
		LEFT JOIN  VND.PurchaseInvoice pi3 
			ON pi3.PurchaseInvoiceID = cpi1.PurchaseInvoiceID
			AND pi3.DlID = pa3.DlID
			AND pi3.Status = 2
			AND pi3.BranchID = r.BranchID
		LEFT JOIN VND.VWConfirmPurchaseInvoiceItemNonePayment vcpiinp
			ON cpii.ConfirmPurchaseInvoiceItemID = vcpiinp.ConfirmPurchaseInvoiceItemID
			AND vcpiinp.NonPayment > 0
		LEFT JOIN VND.PurchaseType pt1
			ON pi3.Type = pt.PurchaseTypeID
			AND pt1.HasConfirmStatement = 1
		LEFT JOIN CNT.AdditionDeductionType adt
			ON adt.AdditionDeductionTypeID = cpii.AdditionDeductionTypeID
	WHERE i.PaymentRequestID = @PaymentRequestID

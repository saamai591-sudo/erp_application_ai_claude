CREATE   PROCEDURE REQ.spGetPaymentRequestBaseDocuments
(
    @Type TINYINT,
    @PartyID BIGINT,
	@BranchID INT,
	@Date DATE
)
--WITH ENCRYPTION

AS
BEGIN
	DECLARE @UserID INT,
	        @DateType TINYINT,
	        @DateFormat VARCHAR(10),
	        @PurchaseInvoice VARCHAR(25),
	        @ReturnedSaleInvoice VARCHAR(50),
			@Sale VARCHAR(25),
			@ConfirmStatement VARCHAR(100),
			@ConfirmStatementItem VARCHAR(100),
			@Contract VARCHAR(25),
			@ContractStatement VARCHAR(100),
			@ConfigValue VARCHAR(25),
			@Internal VARCHAR(25),
			@Foreigner VARCHAR(25), 
			@PurchaseContract VARCHAR(25), 
			@Proposal VARCHAR(25),
		    @Proforma VARCHAR(25),
			@PayPreparing VARCHAR(25),
			@Number NVARCHAR(25),
			@Culture NVARCHAR(10),
			@CultureNo tinyint,
			@DlID bigint,
			@ConfirmPurchaseInvoice NVARCHAR(50),
			@VatPurchaseInvoice NVARCHAR(100)
	    
	SET @UserID = CFG.GetuserID()
	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture	
	
	SET @DateType = CFG.GetCurrentUserDateType()
	SET @DateFormat = CFG.GetCurrentUserDateFormat()

	
	SELECT @ConfirmPurchaseInvoice = lev.[Value]
	FROM   cfg.LocalizeEnum le
			JOIN cfg.LocalizeEnumValue lev
				ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'BaseDocuments'
			AND le.Item = 'ConfirmPurchaseInvoice'
			AND lev.Culture = @Culture


	SELECT @VatPurchaseInvoice = lev.[Value]
	FROM   cfg.LocalizeEnum le
			JOIN cfg.LocalizeEnumValue lev
				ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'PaymentRequestItemBases'
			AND le.Item = 'ConfirmedPurchaseInvoiceVat'
			AND lev.Culture = @Culture

	SELECT @PurchaseInvoice = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'BaseDocuments'
	       AND le.Item = 'PurchaseInvoice'
	       AND lev.Culture = @Culture
	
	SELECT @ReturnedSaleInvoice = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'DocumentNumTypes'
	       AND le.Item = 'ReturnedSaleInvoice'
	       AND lev.Culture = @Culture

	SELECT @Sale = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'VatItemDocType'
	       AND le.Item = 'Sale'
	       AND lev.Culture = @Culture
		   
	SELECT @ConfirmStatement = le.[Value]
	FROM   cfg.VwEnums  le
	WHERE  le.Enum = 'SystemEntities'
	       AND le.Item = 'ConfirmStatement'
	 	
	SELECT @ContractStatement = le.[Value]
	FROM   cfg.VwEnums  le
	WHERE  le.Enum = 'SystemEntities'
	       AND le.Item = 'ContractStatement'
	SELECT @ConfirmStatementItem = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'BaseDocuments'
	       AND le.Item = 'ConfirmStatementItem'
	       AND lev.Culture = @Culture

	SELECT @Contract = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'BaseDocuments'
	       AND le.Item = 'Contract'
	       AND lev.Culture = @Culture

		   
	SELECT @Number = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'GeneralEnum'
	       AND le.Item = 'Number'
	       AND lev.Culture = @Culture

	SELECT @Internal = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'TradeType'
	       AND le.Item = 'Internal'
	       AND lev.Culture = @Culture

	SELECT @Foreigner = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'Nationality'
	       AND le.Item = 'Foreigner'
	       AND lev.Culture = @Culture

	SELECT @PurchaseContract = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'PurchaseDocumentBases'
	       AND le.Item = 'PurchaseContract'
	       AND lev.Culture = @Culture
	
	SELECT @Proposal = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'ProformaInvoiceBases'
	       AND le.Item = 'Proposal'
	       AND lev.Culture = @Culture
	
	SELECT @Proforma = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'CostOfOrderBases'
	       AND le.Item = 'Proforma'
	       AND lev.Culture = @Culture			   

	SELECT @PayPreparing = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'BaseDocuments'
	       AND le.Item = 'PayPreparing'
	       AND lev.Culture = @Culture

	select @DlID = DlID from CFG.Party where PartyID = @PartyID

	IF (@Type = 2)
	BEGIN
	    SELECT p.PurchaseInvoiceID DocumentID,				     
	           @PurchaseInvoice      DocumentName,
	           case when p.InvoiceNumber is not null then p.InvoiceNumber else CAST(p.Number AS NVARCHAR(100)) end Number,
	           p.[Date],
	           CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) DateString,
			   pa.NonPaymented as Non,
			   p.CurrencyID,
			  case when @CultureNo =1 then  cr.Title else cr.Title2 end CurrencyTitle
	    FROM   VND.PurchaseInvoice p
	    JOIN VND.PurchaseInvoice_NonPaymented pa
	        ON  p.PurchaseInvoiceID = pa.PurchaseInvoiceID	
		join VND.PurchaseType pt on pt.PurchaseTypeID = p.Type
		JOIN CFG.Currency cr on p.CurrencyID =cr.CurrencyID
	    WHERE p.DlID = @DlID AND 
			 p.BranchID  =@BranchID AND 
		      pa.NonPaymented > 0 AND
			  p.Status = 2 AND
			  p.[Date] <= @Date
			  AND pt.HasConfirmStatement = 0
	END
	
	IF (@Type = 3)
	BEGIN
	    SELECT r.ReturnedSaleInvoiceID DocumentID,
	           @ReturnedSaleInvoice      DocumentName,
	           CAST(r.Number AS NVARCHAR(100)) Number,
	           r.[Date],
	           CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) DateString,
			   rsi.NonPaymented as Non,
			   r.CurrencyID
	    FROM   SLE.ReturnedSaleInvoice r	          
	           JOIN SLE.ReturnedSaleInvoice_NonPaymented rsi
	                ON  r.ReturnedSaleInvoiceID = rsi.ReturnedSaleInvoiceID					
	    WHERE r.CustomerID = @PartyID AND 
			  r.BranchID = @BranchID AND 
			  r.[Date] <= @Date AND
			  rsi.NonPaymented > 0 
	END
	
	IF (@Type = 4)
	BEGIN
	    SELECT cs.ConfirmStatementID DocumentID,
			   @ConfirmStatement DocumentName,
	           CAST(cs.Number AS NVARCHAR(100)) Number,
	           cs.[Date],
	           CFG.GetCLRSaturnDate(cs.[Date], @DateFormat, 0, @DateType) DateString,
			    vw.Remain as Non,
			   vw.CurrencyID
	    FROM   CNT.ConfirmStatement cs	
		JOIN CNT.Contract c 
			ON c.ContractID = cs.ContractID
	    JOIN CNT.vwConfirmStatementRemain vw on vw.ConfirmStatementID = cs.ConfirmStatementID
	    WHERE vw.PartyID = @PartyID AND
			c.BranchID = @BranchID AND
			cs.[Date] <= @Date AND
		    vw.Remain > 0
			AND cs.ConfirmStatus = 2
			  
	END

	IF (@Type = 5)
	BEGIN
	    SELECT cs.ContractStatementID DocumentID,     
				@ContractStatement DocumentName,
	           CAST(cs1.Number AS NVARCHAR(100)) Number,
	           cs1.[Date],
	           CFG.GetCLRSaturnDate(cs1.[Date], @DateFormat, 0, @DateType) DateString,
			   vw.VatRemain as Non,
			   -1 CurrencyID
	    FROM CNT.ContractStatement cs
		JOIN CNT.Contract c 
			ON c.ContractID = cs.ContractID
		join cnt.ConfirmStatement cs1 on cs1.ContractStatementID = cs.ContractStatementID
	    JOIN CNT.vwContractStatementRemain vw on vw.ContractStatementID = cs.ContractStatementID	
	    WHERE cs.PartyID = @PartyID AND 
			c.BranchID = @BranchID AND
			cs1.[Date] <= @Date AND
		    vw.VatRemain > 0 AND
			cs1.ConfirmStatus = 2
			  
	END

	IF (@Type = 6)
	BEGIN
	    SELECT csi.ConfirmStatementItemID DocumentID,     
			   case @CultureNo
				   when 1 then adt.Title
				   when 2 then adt.Title2
			   end + ' ' + 
			   case when csi.ConfirmStatementID is not null then @ContractStatement + ' '+CAST(cs1.Number as varchar(250))+' '+
			     @ConfirmStatement +' '+CAST(cs.Number as VARCHAR(250)) else @PurchaseInvoice end   DocumentName,
	           case when csi.ConfirmStatementID is not null then CAST(cs.Number AS NVARCHAR(100))  else ISNULL(pi.InvoiceNumber,pi.Number) end Number,
	           case when csi.ConfirmStatementID is not null then cs.[Date] else isnull(pi.InvoiceDate,pi.Date) end Date,
	           CFG.GetCLRSaturnDate(case when csi.ConfirmStatementID is not null then cs.[Date] else isnull(pi.InvoiceDate,pi.Date) end, @DateFormat, 0, @DateType) DateString,
			   vw.Remain as Non,
			   case when csi.ConfirmStatementID is not null then vw.CurrencyID else pi.CurrencyID end CurrencyID
	    FROM CNT.ConfirmStatementItem csi
		join cnt.AdditionDeductionType adt
			on adt.AdditionDeductionTypeID = csi.AdditionDeductionTypeID
		left join CNT.ConfirmStatement cs on csi.ConfirmStatementID = cs.ConfirmStatementID
		JOIN CNT.Contract c 
			ON c.ContractID = cs.ContractID
		left join CNT.ContractStatement cs1 on cs1.ContractStatementID = cs.ContractStatementID
		left join vnd.PurchaseInvoice pi on pi.PurchaseInvoiceID = csi.PurchaseInvoiceID
		left join cfg.party pa on pa.DlID = pi.DlID
		JOIN CNT.vwConfirmStatementItemRemain vw on vw.ConfirmStatementItemID = csi.ConfirmStatementItemID
		left join cnt.ContractStatementDetail csd on csd.ContractStatementDetailID = csi.BaseDocumentID and csd.BaseDocumentType = 3
	    WHERE 
			     (				
				  (pa.DlID is not null and pa.PartyID = @PartyID)
				  or
				  (csi.BaseDocumentType = 3 and  csd.PartyID = @PartyID)
				  or
				  (csi.BaseDocumentType <> 3 and  cs1.PartyID = @PartyID)
				 )
		      and vw.Remain > 0 AND 
				c.BranchID = @BranchID AND 
				CASE WHEN csi.ConfirmStatementID IS NOT NULL THEN cs.[Date] ELSE ISNULL(pi.InvoiceDate,pi.Date) END <= @Date
			  and adt.Payable = 1
			  and (pi.PurchaseInvoiceID is null or pi.Status = 2)
			  and cs.ConfirmStatus = 2
	END
	
	IF (@Type = 7)
	BEGIN
	    SELECT 
				CONCAT(c.ContractID, '_', vw.CurrencyID) AS DocumentID,     
				@Contract DocumentName,
	           CAST(c.Number AS NVARCHAR(100)) Number,
	           c.[Date],
	           CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0, @DateType) DateString,
			   vw.Remain as Non,
			   vw.CurrencyID,
			   case when @CultureNo = 1 then cur.Title else cur.Title2 end CurrencyTitle
	    FROM CNT.[Contract] c 
		JOIN CNT.vwContractRemain vw on vw.ContractID = c.ContractID
		JOIN CFG.Currency as cur ON vw.CurrencyID = cur.CurrencyID
	    WHERE ((c.ContractNature <> 3 and c.PartyID = @PartyID)
			or (c.ContractNature = 3 and @PartyID in (select partyid from cnt.ContractParty where ContractID = c.ContractID ))
			) AND 
			vw.Remain > 0 
			AND c.Status = 2
			AND c.BranchID = @BranchID 
			AND c.[Date] <= @Date
			AND c.CompanyRoll = 1
	END

	IF (@Type = 8)
	BEGIN
	    SELECT  p.ProposalID DocumentID,     
				@Proposal DocumentName,
				CAST(p.Number AS NVARCHAR(100)) Number,
				p.[Date],
				CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) DateString,
				pr.NonPaymented as Non,
				p.CurrencyID
		FROM VND.Proposal p
		JOIN VND.Proposal_NonPaymented pr 
			ON  p.ProposalID = pr.ProposalID
		WHERE p.PartyID = @PartyID 
		AND pr.NonPaymented > 0
		AND p.BranchID = @BranchID
		AND p.[Date] <= @Date
		AND p.[Status] <> 3
	END

	IF (@Type = 9)
	BEGIN
	    SELECT c.PurchaseContractID DocumentID,     
				@PurchaseContract DocumentName,
	           case when c.InvoiceNumber is not null then c.InvoiceNumber else CAST(c.Number AS NVARCHAR(100)) end Number, 
	           c.[Date],
	           CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0, @DateType) DateString,
			   pc.NonPaymented as Non,
			   c.CurrencyID
	    FROM VND.PurchaseContract c
	    JOIN VND.PurchaseContract_NonPaymented pc ON c.PurchaseContractID = pc.PurchaseContractID
	    WHERE c.DlID = @DlID AND 
			  c.BranchID = @BranchID AND
			  c.[Status] != 2 AND
			  c.[Date] <= @Date AND
		      pc.NonPaymented > 0   
	END


	IF (@Type = 11)
	BEGIN
	    SELECT c.ConfirmPurchaseInvoiceID DocumentID,     
			   @ConfirmPurchaseInvoice DocumentName,
	           CAST(c.Number AS NVARCHAR(100)) Number, 
	           c.[Date],
	           CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0, @DateType) DateString,
			   pc.NonPayment as Non,
			   pi.CurrencyID
	    FROM VND.ConfirmPurchaseInvoice c
	    JOIN VND.VWConfirmPurchaseInvoiceNonePayment pc ON c.ConfirmPurchaseInvoiceID = pc.ConfirmPurchaseInvoiceID
		join VND.PurchaseInvoice pi on pi.PurchaseInvoiceID = c.PurchaseInvoiceID
	    WHERE pi.DlID = @DlID
	     and
			  c.ConfirmPurchaseInvoiceStatus = 2 AND 
		      pc.NonPayment > 0  AND 
			  c.[Date] <= @Date AND
			  pi.BranchID = @BranchID
	END

	IF (@Type = 12)
	BEGIN
	    SELECT p.PurchaseInvoiceID DocumentID,				     
	           @VatPurchaseInvoice    DocumentName,
	           case when p.InvoiceNumber is not null then p.InvoiceNumber else CAST(p.Number AS NVARCHAR(100)) end Number,
	           p.[Date],
	           CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) DateString,
			   pa.NonPaymented as Non,
			   -1 CurrencyID
	    FROM   VND.PurchaseInvoice p
	    JOIN VND.PurchaseInvoice_NonPaymented pa
	        ON  p.PurchaseInvoiceID = pa.PurchaseInvoiceID
		join VND.PurchaseType pt on pt.PurchaseTypeID = p.Type
	    WHERE p.DlID = @DlID AND 
		      pa.NonPaymented > 0 and
			  p.Status = 2
			  AND p.[Date] <= @Date
			  and pt.HasConfirmStatement = 1
			  AND p.BranchID = @BranchID
	END

	IF (@Type = 13)
	BEGIN
	    SELECT cpii.ConfirmPurchaseInvoiceItemID DocumentID,				     
			   case when @CultureNo = 1 then adt.Title else adt.Title2 end + ' ' + 
						@PurchaseInvoice + ' ' + ISNULL(p.InvoiceNumber,p.Number)  DocumentName,
	           case when p.InvoiceNumber is not null then p.InvoiceNumber else CAST(p.Number AS NVARCHAR(100)) end Number,
	           p.[Date],
	           CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) DateString,
			   v.NonPayment as Non,
			   p.CurrencyID
			FROM  VND.ConfirmPurchaseInvoiceItem cpii
			join VND.ConfirmPurchaseInvoice c 
				ON cpii.ConfirmPurchaseInvoiceID = c.ConfirmPurchaseInvoiceID
			JOIN VND.PurchaseInvoice p 
				ON p.PurchaseInvoiceID = c.PurchaseInvoiceID 
			JOIN VND.VWConfirmPurchaseInvoiceItemNonePayment v
				ON cpii.ConfirmPurchaseInvoiceItemID = v.ConfirmPurchaseInvoiceItemID 
			JOIN VND.PurchaseType t 
				ON p.[Type] = t.PurchaseTypeID 
			join CNT.AdditionDeductionType adt
				on adt.AdditionDeductionTypeID = cpii.AdditionDeductionTypeID
	    WHERE p.DlID = @DlID AND 
		      v.NonPayment > 0 and
			  p.Status = 2
			  AND p.[Date] <= @Date
			  and c.ConfirmPurchaseInvoiceStatus = 2
			  and t.HasConfirmStatement = 1
			  AND p.BranchID = @BranchID

	END
END

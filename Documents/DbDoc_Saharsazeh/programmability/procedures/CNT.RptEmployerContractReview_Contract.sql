-------------------------------- STRAT #NOTASK
CREATE   PROC [CNT].RptEmployerContractReview_Contract
    (
        @Contracts VARCHAR(MAX) = NULL
    )
--WITH ENCRYPTION
AS
    DECLARE @UserID INT ,
            @DateType TINYINT ,
            @Culture VARCHAR(10) ,
            @DateFormat VARCHAR(10) ,
            @Columns NVARCHAR(MAX) ,
            @ColumnsInPayedSelectList NVARCHAR(MAX) ,
            @ColumnsInSelectList NVARCHAR(MAX) ,
            @query NVARCHAR(MAX) ,
            @param NVARCHAR(MAX) ,
            @CodeAndTitleColumn NVARCHAR(MAX) ,
            @LeftJoin NVARCHAR(MAX) ,
            @CultureNo TINYINT;

    SELECT @Columns = STUFF(
    (   SELECT DISTINCT ',' + QUOTENAME(AdditionDeductionTypeID)
        FROM   CNT.AdditionDeductionType
        FOR XML PATH(''), TYPE ).value('.', 'NVARCHAR(MAX)') ,1   ,1   ,''  );

    IF ( @Columns IS NULL )
        SET @Columns = '[-1]';

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM   CFG.CultureInfo
    WHERE  Culture = @Culture;

    SELECT @DateType = us.SettingValue
    FROM   CFG.UserSetting us
    WHERE  us.SettingKey = 'Date_Type'
           AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                             WHEN 'fa' THEN 0
                             WHEN 'en' THEN 1
                             WHEN 'ar' THEN 2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM   CFG.UserSetting us
    WHERE  us.SettingKey = 'Date_Format'
           AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    SELECT @ColumnsInSelectList = STUFF(
    (   SELECT DISTINCT ',ISNULL(p1.' + QUOTENAME(AdditionDeductionTypeID)
                        + ',0) AS T'
                        + CAST(AdditionDeductionTypeID AS VARCHAR(10))
        FROM   CNT.AdditionDeductionType
        FOR XML PATH(''), TYPE        ).value('.', 'NVARCHAR(MAX)') ,1   ,0   ,''  );

    IF ( @ColumnsInSelectList IS NULL )
        SET @ColumnsInSelectList = '';

    SELECT @ColumnsInPayedSelectList = STUFF(
    (   SELECT DISTINCT ',ISNULL(p2.' + QUOTENAME(AdditionDeductionTypeID)
                        + ',0) AS PayedT'
                        + CAST(AdditionDeductionTypeID AS VARCHAR(10))
        FROM   CNT.AdditionDeductionType
        FOR XML PATH(''), TYPE             ).value('.', 'NVARCHAR(MAX)') ,1   ,0   ,''  );

    IF ( @ColumnsInPayedSelectList IS NULL )
        SET @ColumnsInPayedSelectList = '';

	SELECT * 
	INTO #vwBranchAccess 
	FROM cfg.vwBranchAccess 

	SELECT ContractID,
		CurrencyID,
		SUM(CASE WHEN ReceiptAndPaymentType = 'AdvanceReceive' then Amount else 0 end) DownReceived,
		SUM(CASE WHEN ReceiptAndPaymentType = 'OnAccount' then Amount else 0 end)   OnAccount,
		SUM(CASE WHEN BaseDocumentType = 'confirmstatement' then Amount else 0 end) ReceivedConfirmStatement,
		SUM(CASE WHEN BaseDocumentType = 'PurchaseInvoice' then Amount else 0 end)  ReceivedInvoice
	INTO #ReceiptAndPayment
	FROM [CNT].VWReceiptAndPayment
	GROUP BY ContractID, CurrencyID	

	SELECT  ContractID,
		OriginVatCurrency ,
		SUM(Amount)  ReceivedVat
	INTO #ReceiptAndPayment_Vat
	FROM [CNT].VWReceiptAndPayment
	WHERE BaseDocumentType = 'Vat'
	GROUP BY ContractID, OriginVatCurrency

	select  ContractID,
			CurrencyID,
			SUM(FunctionalStatement) FunctionalStatement,
			SUM(AdjustmentStatement) AdjustmentStatement,
			SUM(SuspensionStatement) SuspensionStatement,
			SUM(Vat) Vat
	into #CSR1
	from
	(
	select  a.ContractID,
			b.CurrencyID,
			case when c.[Type] in (1,4) then Amount else 0 end FunctionalStatement,
			case when c.[Type] = 2 then Amount else 0 end AdjustmentStatement,
			case when c.[Type] = 3 then Amount else 0 end SuspensionStatement,
			Vat
	from cnt.ConfirmStatement a
	join cnt.ContractStatement b on a.ContractStatementID = b.ContractStatementID
	join cnt.ContractStatementType c on c.ContractStatementTypeID = b.ContractStatementTypeID
	join 
		(
			select ContractStatementID,SUM(Tax + Duty) Vat
			from CNT.ContractStatementitem
			group by ContractStatementID
		)d on d.ContractStatementID = b.ContractStatementID
	)a
	group by a.ContractID,a.CurrencyID

    SET @query = N'   
	SELECT c.ContractID ,
		   case when  @CultureNo = 1 then ct.Title else ct.Title2 end as ContractType,
           d.Code ContractDlCode ,
           c.Number ,
		   case when @CultureNo = 1 then c.Title else c.Title2 end as Title ,
           d2.Code PartyDlCode ,            
		   case when @CultureNo = 1 then d2.Title else d2.Title2 end as PartyName,
		   case when @CultureNo = 1 then c2.Title else c2.Title2 end as Currency,
		   c2.CurrencyID,
           vw.price Total ,
		   csr.FunctionalStatement,
		   csr.AdjustmentStatement,
		   csr.SuspensionStatement,
		   cc.ReceivedConfirmStatement,
		   isnull(Invoice.InvoiceAmount,0) InvoiceAmount,
		   isnull(Invoice.vat,0) InvoiceVat,
		   isnull(cc.ReceivedInvoice,0) ReceivedInvoice,
		   isnull(csr.Vat,0) Vat,
		   ReceivedVat,
		   cc.DownReceived,
		   cc.OnAccount
		   ' + @ColumnsInSelectList + @ColumnsInPayedSelectList+ ',
		   isnull(Commitment.Amount,0) Commitment,
		   case when vw.Price = 0 then 0 else (isnull(csr.FunctionalStatement,0) + isnull(Invoice.InvoiceAmount,0)) / vw.Price * 100 end [Progress]
    FROM   CNT.Contract c
           JOIN CNT.ContractType ct ON c.ContractTypeID = ct.ContractTypeID
           JOIN ACC.DL d ON d.DLID = c.DLID
           JOIN CFG.Party p ON p.PartyID = c.PartyID
           LEFT JOIN ACC.DL d2 ON d2.DLID = p.DLID
           JOIN CFG.Branch b ON b.BranchID = c.BranchID
		   JOIN  #vwBranchAccess Branch on Branch.BranchID = B.BranchID
		   join 
		    (
				select ContractID,CurrencyID,sum(price) Price
				from	cnt.vwcontractsubject
				group by ContractID,CurrencyID
			) vw
				on c.ContractID = vw.ContractID
			JOIN CFG.Currency c2 ON vw.CurrencyID = c2.CurrencyID
			left JOIN #ReceiptAndPayment cc ON cc.ContractID = c.ContractID and cc.CurrencyID = c2.CurrencyID
			left join #CSR1 csr on csr.ContractID = c.ContractID and csr.CurrencyID = vw.CurrencyID
			left join
			(
				SELECT   ContractID ,
						 b.CurrencyID,
						 SUM(a.NetPrice) InvoiceAmount,
						 sum(a.tax+a.duty) vat
				FROM     SLE.InvoiceItem AS a
						 JOIN CNT.ContractSubject b ON a.ContractSubjectID = b.ContractSubjectID
				GROUP BY ContractID,b.CurrencyID
			) Invoice
				on Invoice.ContractID = c.ContractID and invoice.CurrencyID = c2.CurrencyID
			left join #ReceiptAndPayment_Vat vat on vat.ContractID = c.ContractID and vat.OriginVatCurrency = c2.CurrencyID
			left join
			(
				select AdditionDeductionTypeID,ContractID,CurrencyID,SUM(Net) Value
				from CNT.vwConfirmStatementItemRemain 
				group by AdditionDeductionTypeID,ContractID,CurrencyID
			)x
			pivot
			(
			max(value)
			for AdditionDeductionTypeID in (' + @Columns + ')			
			)P1 on p1.ContractID = c.ContractID and p1.CurrencyID = c2.CurrencyID
			left join
			(
				select AdditionDeductionTypeID,ContractID,CurrencyID,SUM(Done) Value
				from CNT.vwConfirmStatementItemRemain 
				group by AdditionDeductionTypeID,ContractID	,CurrencyID	
			)x
			pivot
			(
			max(value)
			for AdditionDeductionTypeID in (' + @Columns + ')			
			)P2 on p2.ContractID = c.ContractID and p2.CurrencyID = c2.CurrencyID
			left join 
			(	select ContractID,CurrencyID,SUM(Amount) Amount
				from CNT.VWContractCommitment
				group by ContractID	,CurrencyID
			) Commitment
			on Commitment.ContractID = c.ContractID and Commitment.CurrencyID = c2.CurrencyID
		WHERE  
			   (   @pContracts IS NULL
				   OR c.ContractID IN (   SELECT value
										  FROM   CFG.R_FnCommaStr2Table(@pContracts) ))
		and c.type = 1
		AND c.CompanyRoll = 2';
    SET @param = N'@pContracts varchar(max), @pDateFormat varchar(max),  @pDateType int,@CultureNo TINYINT';

    EXECUTE sp_executesql @query ,
                          @param ,
                          @pContracts = @Contracts ,
                          @pDateFormat = @DateFormat ,
                          @pDateType = @DateType ,
						  @CultureNo = @CultureNo;

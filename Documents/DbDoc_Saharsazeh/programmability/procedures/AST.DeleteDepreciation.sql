
CREATE   PROCEDURE [AST].DeleteDepreciation
(
	@DocumentID			INT ,
	@Document			NVARCHAR(250),
	@Message			NVARCHAR(MAX) OUTPUT
)
--WITH ENCRYPTION

as
DECLARE @FinancialPeriodID         INT,
        @BranchID                  INT,
        @DestructionID             INT,
        @SalvageID                 INT,
        @SaleID                    INT,
        @TransferID                INT,
        @ChangeCategoryID          INT,
        @VoucherOrPrevoucherID     INT,
        @PeriodStartDate		DATE;


if @Document = 'DepreciationCalculation'
BEGIN
	SELECT @FinancialPeriodID		  = dp.FinancialPeriodID,
	       @BranchID                  = dc.BranchID,
	       @VoucherOrPrevoucherID     = dc.VoucherID
	FROM   ast.DepreciationCalculation  AS dc
	       JOIN ast.DepreciationPeriod  AS dp
	            ON  dp.DepreciationPeriodID = dc.DepreciationPeriodID
	WHERE  dc.DepreciationCalculationID = @DocumentID
END
if @Document = 'Destruction'
BEGIN
	SELECT @FinancialPeriodID		  = d.FinancialPeriodID,
	       @BranchID                  = d.BranchID,
	       @VoucherOrPrevoucherID     = d.PreVoucherID
	FROM   ast.Destruction AS d
	WHERE  d.DestructionID = @DocumentID
END
if @Document = 'Sale'
BEGIN
	SELECT @FinancialPeriodID		  = d.FinancialPeriodID,
	       @BranchID                  = d.BranchID,
	       @VoucherOrPrevoucherID     = d.PrevoucherID
	FROM   ast.Sale AS d
	WHERE  d.SaleID = @DocumentID
END
if @Document = 'Salvage'
BEGIN
	SELECT @FinancialPeriodID		  = d.FinancialPeriodID,
	       @BranchID                  = d.BranchID,
	       @VoucherOrPrevoucherID     = d.PreVoucherID
	FROM   ast.Salvage AS d
	WHERE  d.SalvageID = @DocumentID
END
if @Document = 'Transfer'
BEGIN
	SELECT @FinancialPeriodID		  = d.FinancialPeriodID,
	       @BranchID                  = d.SourceBranchID,
	       @VoucherOrPrevoucherID     = d.PreVoucherID
	FROM   ast.Transfer AS d
	WHERE  d.TransferID = @DocumentID
END

if @Document = 'ChangeCategory'
BEGIN
	SELECT @FinancialPeriodID         = d.FinancialPeriodID,
	       @BranchID                  = d.BranchID,
	       @VoucherOrPrevoucherID     = d.PreVoucherID
	FROM   ast.ChangeCategory AS d
	WHERE  d.ChangeCategoryID = @DocumentID
END

if @Document = 'Revaluation'
BEGIN
	SELECT @FinancialPeriodID         = d.FinancialPeriodID,
	       @BranchID                  = d.BranchID,
	       @VoucherOrPrevoucherID     = d.PreVoucherID
	FROM   ast.Revaluation AS d
	WHERE  d.RevaluationID = @DocumentID
END

	IF EXISTS (
	       SELECT 1
	       FROM   ast.AssetClosingOperation a
	       WHERE  a.FinancialPeriodID = @FinancialPeriodID
	              AND a.BranchID = @BranchID
	   )
	BEGIN
	    SET @Message = 'به دلیل بسته بودن سیستم دارایی ثابت در شعب انتخاب شده، انجام این عملیات مجاز نیست.'
	    return
	END
	
	IF @Document = 'DepreciationCalculation'
	BEGIN
	    IF @VoucherOrPrevoucherID is NOT NULL
	    BEGIN
	        SET @Message = 'برخی از ردیفهای انتخاب شده دارای سند هستند.'
	        return
	    END
	END



	select * into #Out 
	from(
	SELECT assetid,
	       DATE,
	       s.SaleStatus OutStatus
	FROM   ast.SaleItem si
	       JOIN ast.Sale s
	            ON  s.SaleID = si.SaleID
	UNION all
	SELECT assetid,
	       DATE,
	       s.SalvageStatus
	FROM   ast.SalvageItem si
	       JOIN ast.Salvage s
	            ON  s.SalvageID = si.SalvageID
	UNION all
	SELECT assetid,
	       DATE,
	       s.DestructionStatus
	FROM   ast.DestructionItem si
	       JOIN ast.Destruction s
	            ON  s.DestructionID = si.DestructionID
	UNION all
	SELECT ti.AssetID,
	       t.[Date],
	       t.TransferStatus
	FROM   ast.[Transfer]         AS t
	       JOIN ast.TransferItem  AS ti
	            ON  ti.TransferID = t.TransferID
		) a



	if exists (
	SELECT 1 FROM ast.Depreciation AS d
	 join ast.Depreciation AS d2 on d.AssetID=d2.AssetID and d2.[Date]>d.[Date] and concat(d2.Document,'-',d2.DocumentID)<> concat(@Document,'-',@DocumentID)
	WHERE d.[Document] = @Document and d.DocumentID = @DocumentID 
	)
	BEGIN
		
		set @Message = 'برخی از دارایی ها در  تاریخهای بزرگتر دارای محاسبه استهلاک می باشند.'
		return
	END
	

	if exists (SELECT * FROM ast.Depreciation AS d
	 join #Out AS o on d.AssetID = o.AssetID and o.[Date] > d.[Date] and o.OutStatus =  2
	 where concat(d.Document,'-',d.DocumentID)<> concat(@Document,'-',@DocumentID)
	 and d.Document = @Document and d.DocumentID = @DocumentID
	 	)	
	BEGIN
		set @Message =  'برخی از ردیفها در یکی از عملیاتهای خروج دارایی شرکت داشته اند.'
	Return	
	END	 
		
	DELETE FROM ast.Depreciation
	WHERE [Document] = @Document and DocumentID = @DocumentID

	if @Document = 'DepreciationCalculation'
	BEGIN

		DELETE FROM ast.DepreciationCalculation WHERE DepreciationCalculationID = @DocumentID
	END


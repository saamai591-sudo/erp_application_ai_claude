CREATE   PROC [ACC].[spPreVoucherUpdate] 
    @PreVoucherID INT,
    @DocumentNumtypeID SMALLINT,
    @FinancialPeriodID INT,
	@date   DATE,   
    @Description NVARCHAR(MAX),
    @Description2 NVARCHAR(MAX),
    @BranchID    INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT

		--WITH ENCRYPTION 
AS 
SET NOCOUNT ON 
 
DECLARE @voucherID INT

SELECT @voucherID = VoucherID
FROM   acc.VoucherPrevoucher vp
WHERE  PrevoucherID = @PreVoucherID
	
IF @Version <> (
       SELECT [Version]
       FROM   [ACC].[PreVoucher]
       WHERE  [PreVoucherID] = @PreVoucherID
   )
   OR @voucherID IS NOT NULL
BEGIN
    RAISERROR('Version mismatch...', 16, 10)
    RETURN
END

UPDATE [ACC].[PreVoucher]
SET    [DocumentNumtypeID] = @DocumentNumtypeID,
       [Description] = @Description,
       [Description2] = @Description2,
       BranchID = @BranchID,
       [LastEditor] = @LastEditor,
       [LastEditionDate] = @LastEditionDate,
       [Version] = @Version + 1
WHERE  [PreVoucherID] = @PreVoucherID
	
		-- Begin Return Select <- do not remove
SELECT [Version]
FROM   [ACC].[PreVoucher]
WHERE  [PreVoucherID] = @PreVoucherID 
       -- End Return Select <- do not remove

CREATE   PROC [HRM].[spAgreementParameterInsert] 
    @Type TINYINT,
    @AgreementID INT,
    @ParameterID INT,
    @Amount DECIMAL(30, 4),
    @ExecuteDate DATE,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION 
AS 
BEGIN
    SET NOCOUNT ON 
    IF @ExecuteDate<(SELECT  a.ExecuteDate FROM hrm.Agreement AS a
	                 WHERE a.AgreementID=@AgreementID)
	BEGIN
	    RAISERROR('تاريخ اجرا عامل نمي تواند کوچکتر از تاريخ اجراي قرارداد باشد.', 16, 12)      	
	    RETURN          	
	END
	
    INSERT INTO [HRM].[AgreementParameter]
      (
        [Type],
        [AgreementID],
        [ParameterID],
        [Amount],
        [ExecuteDate],
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate]
      )
    SELECT @Type,
           @AgreementID,
           @ParameterID,
           @Amount,
           @ExecuteDate,
           0,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate
	    -- Begin Return Select <- do not remove
    SELECT [AgreementParameterID],
           [Version]
    FROM   [HRM].[AgreementParameter]
    WHERE  [AgreementParameterID] = SCOPE_IDENTITY()
	    -- End Return Select <- do not remove
END

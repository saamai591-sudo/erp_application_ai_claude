
CREATE   PROC [HRM].[spAgreementParameterUpdate] 
    @AgreementParameterID INT,
    @Type TINYINT,
    @AgreementID INT,
    @ParameterID INT,
    @Amount DECIMAL(30, 4),
    @ExecuteDate DATE,
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME

		--WITH ENCRYPTION 
AS 
SET NOCOUNT ON 


	
	
IF @Version = (
       SELECT [Version]
       FROM   [HRM].[AgreementParameter]
       WHERE  [AgreementParameterID] = @AgreementParameterID
   )
BEGIN
    



	 --IF  ( SELECT ExecuteDate FROM hrm.Agreement
	 --WHERE AgreementID=@AgreementID) > @ExecuteDate 
  --  BEGIN
  --      RAISERROR('تاريخ اجرا عامل نمي تواند کوچکتر از تاريخ اجراي قرارداد باشد.', 16, 12);      	
  --      RETURN;          	
  --  END;
    
    UPDATE [HRM].[AgreementParameter]
    SET    [Type] = @Type,
           [AgreementID] = @AgreementID,
           [ParameterID] = @ParameterID,
           [Amount] = @Amount,
           [ExecuteDate] = @ExecuteDate,
           [Version] = @Version,
           [Creator] = @Creator,
           [CreationDate] = @CreationDate,
           [LastEditor] = @LastEditor,
           [LastEditionDate] = @LastEditionDate
    WHERE  [AgreementParameterID] = @AgreementParameterID
    
    -- Begin Return Select <- do not remove
    SELECT [Version]
	FROM   [HRM].[AgreementParameter]
    WHERE  [AgreementParameterID] = @AgreementParameterID 
    -- End Return Select <- do not remove
    
    
END

CREATE PROC [HRM].[SpAgreementTypeInterpretationUpdate] 
    @AgreementTypeInterpretationID int,
    @AgreementTypeID tinyint,
    @PaymentSystemID int,
    @ParameterID int,
    @InterpretationType tinyint,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	if @Version <> (Select [Version] from [HRM].[AgreementTypeInterpretation]
				where [AgreementTypeInterpretationID] = @AgreementTypeInterpretationID)
	begin
	RAISERROR('Version mismatch...', 16 , 10)
	return
	end

	set @Version = @Version +1 

	UPDATE [HRM].[AgreementTypeInterpretation]
	SET    [AgreementTypeID] = @AgreementTypeID, [PaymentSystemID] = @PaymentSystemID, [ParameterID] = @ParameterID, [InterpretationType] = @InterpretationType, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate, [Version] = @Version
	WHERE  [AgreementTypeInterpretationID] = @AgreementTypeInterpretationID
	
	-- Begin Return Select <- do not remove
	SELECT  [Version]
	FROM   [HRM].[AgreementTypeInterpretation]
	WHERE  [AgreementTypeInterpretationID] = @AgreementTypeInterpretationID	
	-- End Return Select <- do not remove

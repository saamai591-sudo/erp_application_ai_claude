CREATE PROC [HRM].[spAgreementBatchModelFormulaDelete] 
    @AgreementBatchModelFormulaID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from [HRM].[AgreementBatchModelFormula]
	where [AgreementBatchModelFormulaID] = @AgreementBatchModelFormulaID)
	begin	



		DELETE
		FROM   [HRM].[AgreementBatchModelFormula]
		WHERE  [AgreementBatchModelFormulaID] = @AgreementBatchModelFormulaID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'AgreementBatchModelFormula', -- First argument.
		@AgreementBatchModelFormulaID); -- Second argument.)
	end


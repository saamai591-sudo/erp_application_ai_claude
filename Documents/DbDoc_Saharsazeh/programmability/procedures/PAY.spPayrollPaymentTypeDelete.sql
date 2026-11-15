
CREATE    PROC [PAY].[spPayrollPaymentTypeDelete] 
    @PayrollPaymentTypeID int,
    @Version INT
AS 
	SET NOCOUNT ON 
	IF @Version = (   SELECT [Version]
                      FROM   [PAY].[PayrollPaymentType]
                      WHERE  [PayrollPaymentTypeID] = @PayrollPaymentTypeID )
        BEGIN

		DELETE
			FROM   [PAY].[PayrollPaymentType]
		WHERE  [PayrollPaymentTypeID] = @PayrollPaymentTypeID 

        END;
    ELSE
        BEGIN

            RAISERROR(N'Delete_%s_%d.' ,   -- Message text.
                      16 ,                 -- Severity,
                      10 ,                 -- State,
                      N'PayrollPaymentType' , -- First argument.
                      @PayrollPaymentTypeID); -- Second argument.)
        END;

